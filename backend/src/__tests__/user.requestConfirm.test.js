import mongoose from 'mongoose'

import {
  connect,
  closeDatabase,
  clearDatabase,
} from '#root/utils/dbConnectionTest'
import graphqlCall from '#root/utils/graphqlCall'
import {transport} from '#root/utils/mail'
import {user} from '#root/models'

const REQUEST_CONFIRM_MUTATION = `
  mutation {
    requestConfirm {
      status
      message
    }
  }
`

beforeAll(() => connect())
afterAll(() => closeDatabase())
afterEach(() => clearDatabase())

const fakeUser = {
  name: 'Test',
  email: 'test@test.com',
  password: 'secretPass123!',
}

test('returns error when user not authenticated', async () => {
  await user.create({
    ...fakeUser,
  })

  const {errors} = await graphqlCall(REQUEST_CONFIRM_MUTATION, null, null)

  expect(errors[0].message).toMatch(/you must be logged in to do that/i)
})

test('returns error when user not found', async () => {
  const userId = new mongoose.Types.ObjectId()

  const context = {
    req: {userId},
    res: {},
  }

  const {errors} = await graphqlCall(REQUEST_CONFIRM_MUTATION, context, null)

  expect(errors[0].message).toMatch(/problem with requesting confirm token/i)
})

test('returns error when user already confirmed', async () => {
  const newUser = await user.create({
    ...fakeUser,
    confirmed: true,
  })

  const context = {
    req: {userId: newUser.id},
    res: {},
  }

  const {errors} = await graphqlCall(REQUEST_CONFIRM_MUTATION, context, null)

  expect(errors[0].message).toMatch(/confirmed/i)
})

test('returns status on success, update user and send email', async () => {
  const fakeToken = 'faketoken123'
  const fakeExpiry = Date.now() - 1 * 60 * 60 * 1000

  const newUser = await user.create({
    ...fakeUser,
    confirmToken: fakeToken,
    confirmTokenExpiry: fakeExpiry,
  })

  const context = {
    req: {userId: newUser.id},
    res: {},
  }

  transport.sendMail = jest.fn()

  const {data} = await graphqlCall(REQUEST_CONFIRM_MUTATION, context, null)

  const updatedUser = await user
    .findById(newUser.id)
    .select('confirmToken confirmTokenExpiry')
    .lean()

  expect(transport.sendMail).toHaveBeenCalledWith(
    expect.objectContaining({
      subject: 'Please confirm your account!',
      to: newUser.email,
    }),
  )

  expect(updatedUser.confirmToken).toBeTruthy()
  expect(updatedUser.confirmToken).not.toBe(fakeToken)

  expect(updatedUser.confirmTokenExpiry).toBeTruthy()
  expect(updatedUser.confirmTokenExpiry).not.toBe(fakeExpiry)

  expect(data.requestConfirm).toHaveProperty(
    'message',
    expect.stringMatching(/email sent/i),
  )

  transport.sendMail.mockReset()
})
