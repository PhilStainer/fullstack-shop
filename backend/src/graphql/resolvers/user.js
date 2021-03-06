'use strict'

import bcrypt from 'bcryptjs'

import isAuthenticated from '#root/utils/isAuthenticated'
import {
  signUpSchema,
  requestReset,
  resetPassword,
  changePassword,
  changeEmail,
} from '#root/JoiSchemas'
import selectedFields from '#root/utils/selectedFields'
import generateUserCookie from '#root/utils/generateUserCookie'
import {transport, basicTemplate} from '#root/utils/mail'
import generateToken from '#root/utils/generateToken'

const resolvers = {
  Query: {
    me: async (parent, args, ctx, info) => {
      if (!ctx?.req?.userId) return null

      const selected = selectedFields(info, ['cart'])

      const foundUser = await ctx.db.user
        .findById(ctx.req.userId)
        .select(selected)
        .lean()

      return foundUser
    },
  },
  Mutation: {
    signUp: async (parent, args, ctx, info) => {
      // Check logged in
      if (ctx?.req?.userId) throw new Error('You are already logged in!')

      // Validate input
      await signUpSchema.validateAsync(args, {abortEarly: false})

      // Hash password
      const password = await bcrypt.hash(args.password, 10)

      // Generate Confirm account token
      const token = await generateToken()

      // Create user
      // hour * minute * second * millisecond
      const createdUser = await ctx.db.user.create({
        ...args,
        password,
        confirmToken: token,
        confirmTokenExpiry: Date.now() + 1 * 60 * 60 * 1000,
      })

      // Send confirm account email
      await transport.sendMail({
        from: 'noreply@fullstackshop.com',
        to: createdUser.email,
        subject: 'Please confirm your account!',
        html: basicTemplate(`Confirm your account with us!
          \n\n
          <a href="${process.env.FRONTEND_URL}/confirm?confirmToken=${token}">Click here to confirm</a>`),
      })

      // Generate Cookie
      generateUserCookie(createdUser, ctx)

      return createdUser
    },
    signOut: (parent, args, ctx, info) => {
      isAuthenticated(ctx)

      ctx.res.clearCookie('token')

      return {status: 'Success', message: 'See you soon'}
    },
    signIn: async (parent, {email, password}, ctx, info) => {
      const errorMessage = 'Incorrect email or password'

      const selected = selectedFields(info)

      // Check user
      const foundUser = await ctx.db.user
        .findOne({email})
        .select(`${selected} password`)
        .lean()

      if (!foundUser) throw new Error(errorMessage)

      // Check password
      const isValid = await bcrypt.compare(password, foundUser.password)

      if (!isValid) throw new Error(errorMessage)

      // Generate Cookie
      generateUserCookie(foundUser, ctx)

      return foundUser
    },
    confirmAccount: async (parent, {confirmToken}, ctx, info) => {
      const errorMessage = 'Token invalid or expired'

      const foundUser = await ctx.db.user
        .findOne({
          confirmToken,
          confirmTokenExpiry: {$gte: Date.now()}, // Confirm token expiry > Date.now
        })
        .select('_id')
        .lean()

      if (!foundUser) throw new Error(errorMessage)

      await ctx.db.user
        .findByIdAndUpdate(foundUser._id, {
          confirmed: true,
          confirmToken: null,
          confirmTokenExpiry: null,
        })
        .select('_id')
        .lean()

      return {
        status: 'Success',
        message: 'Account has now been confirmed, please log in!',
      }
    },
    requestConfirm: async (parents, args, ctx, info) => {
      isAuthenticated(ctx)

      const foundUser = await ctx.db.user
        .findById(ctx.req.userId)
        .select('confirmed email')
        .lean()

      if (!foundUser) throw new Error('Problem with requesting confirm token')
      if (foundUser?.confirmed)
        throw new Error('Account has already been confirmed')

      // Generate Confirm account token
      const token = await generateToken()

      // Update user
      await ctx.db.user.findByIdAndUpdate(ctx.req.userId, {
        confirmToken: token,
        confirmTokenExpiry: Date.now() + 1 * 60 * 60 * 1000,
      })

      // Send confirm account email
      await transport.sendMail({
        from: 'noreply@fullstackshop.com',
        to: foundUser.email,
        subject: 'Please confirm your account!',
        html: basicTemplate(`Confirm your account with us!
          \n\n
          <a href="${process.env.FRONTEND_URL}/confirm?confirmToken=${token}">Click here to confirm</a>`),
      })

      return {
        status: 'Success',
        message: 'Email sent! please confirm your account',
      }
    },
    requestReset: async (parent, {email}, ctx, info) => {
      // Check logged in
      if (ctx?.req?.userId) throw new Error('You are already logged in!')

      // Validate input
      await requestReset.validateAsync({email})

      const successObject = {
        status: 'Success',
        message: 'Email sent to your account',
      }

      const user = await ctx.db.user.findOne({email}).select('_id').lean()

      if (user) {
        // Generate Confirm account token
        const token = await generateToken()

        // Update user
        await ctx.db.user.findByIdAndUpdate(user._id, {
          resetToken: token,
          resetTokenExpiry: Date.now() + 15 * 60 * 1000,
        })

        // Send confirm account email
        await transport.sendMail({
          from: 'noreply@fullstackshop.com',
          to: email,
          subject: 'Your Password Reset Token',
          html: basicTemplate(`Your Password Reset Token is here!
    \n\n
    <a href="${process.env.FRONTEND_URL}/reset?resetToken=${token}">Click here to Reset</a>`),
        })
      }

      return successObject
    },
    resetPassword: async (parent, args, ctx, info) => {
      // Validate input
      await resetPassword.validateAsync(args, {abortEarly: false})

      const foundUser = await ctx.db.user
        .findOne({
          resetToken: args.resetToken,
          resetTokenExpiry: {$gte: Date.now()}, // Confirm token expiry > Date.now
        })
        .select('_id')
        .lean()

      if (!foundUser) throw new Error('Token invalid or expired')

      const selected = selectedFields(info)

      // Hash password
      const password = await bcrypt.hash(args.password, 10)

      // Update user
      const updatedUser = await ctx.db.user
        .findByIdAndUpdate(
          foundUser._id,
          {
            password,
            resetToken: null,
            resetTokenExpiry: null,
          },
          {new: true},
        )
        .select(selected)
        .lean()

      generateUserCookie(updatedUser, ctx)

      return updatedUser
    },
    changePassword: async (parent, args, ctx, info) => {
      isAuthenticated(ctx)

      await changePassword.validateAsync(args, {abortEarly: false})

      const foundUser = await ctx.db.user
        .findById(ctx.req.userId)
        .select('_id password')
        .lean()

      if (!foundUser) throw new Error('Error finding details')

      const isValid = await bcrypt.compare(
        args.currentPassword,
        foundUser.password,
      )

      if (!isValid) throw new Error('Invalid password')

      const password = await bcrypt.hash(args.password, 10)

      await ctx.db.user
        .findByIdAndUpdate(foundUser._id, {
          password,
        })
        .select('_id')
        .lean()

      return {
        status: 'Success',
        message: 'Password successfully updated!',
      }
    },
    changeEmail: async (parent, args, ctx, info) => {
      isAuthenticated(ctx)

      await changeEmail.validateAsync(args, {abortEarly: false})

      const foundUser = await ctx.db.user
        .findById(ctx.req.userId)
        .select('_id password')
        .lean()

      if (!foundUser) throw new Error('Error finding details')

      const isValid = await bcrypt.compare(args.password, foundUser.password)

      if (!isValid) throw new Error('Invalid password')

      await ctx.db.user
        .findByIdAndUpdate(foundUser._id, {
          email: args.email,
        })
        .select('_id')
        .lean()

      return {
        status: 'Success',
        message: 'Email successfully updated!',
      }
    },
    addToCart: async (parent, {id}, ctx, info) => {
      isAuthenticated(ctx)

      const foundItem = await ctx.db.cartItem
        .findOne({user: ctx.req.userId, item: id})
        .select('_id')
        .lean()

      if (foundItem) {
        return ctx.db.cartItem
          .findByIdAndUpdate(foundItem._id, {$inc: {quantity: 1}}, {new: true})
          .populate('item')
          .lean()
      }

      const createdItem = await ctx.db.cartItem.create({
        user: ctx.req.userId,
        item: id,
      })

      return createdItem.populate('item').execPopulate()
    },
    removeFromCart: async (parent, {id}, ctx, info) => {
      isAuthenticated(ctx)

      const foundItem = await ctx.db.cartItem
        .findOne({
          user: ctx.req.userId,
          _id: id,
        })
        .select('_id')
        .lean()

      if (!foundItem) {
        throw new Error('No CartItem Found...')
      }

      return ctx.db.cartItem
        .findByIdAndRemove(foundItem._id)
        .populate('item')
        .lean()
    },
  },
  User: {
    cart: (parent, args, ctx, info) => {
      return ctx.loader.cartItems.load(parent._id)
    },
  },
}

export default resolvers
