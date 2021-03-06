import Joi from '@hapi/joi'

export const name = Joi.string().min(3).max(30).required()
export const email = Joi.string().email().required()
export const password = Joi.string()
  .pattern(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[//,.?;<>:!@#$%^&*(-=_+)|{}\[\]])[A-Za-z\d//,.?;<>:!@#$%^&*(-=_+)|{}\[\]]{8,30}$/,
  )
  .required()
  .messages({
    'string.pattern.base':
      '"password" does not meet complexity the requirements',
  })
export const confirmPassword = Joi.any()
  .valid(Joi.ref('password'))
  .messages({'any.only': '"password" and "confirm password" do not match'})

export const token = Joi.string().hex().required()

export const signUpSchema = Joi.object({name, email, password, confirmPassword})
export const requestReset = Joi.object({email})
export const resetPassword = Joi.object({
  resetToken: token,
  password,
  confirmPassword,
})

export const currentPassword = Joi.string().required()
export const changePassword = Joi.object({
  currentPassword,
  password,
  confirmPassword,
})

export const confirmEmail = Joi.any()
  .valid(Joi.ref('email'))
  .messages({'any.only': '"email" and "confirm email" do not match'})
export const userPassword = Joi.string().required()
export const changeEmail = Joi.object({
  password: userPassword,
  email,
  confirmEmail,
})

export const title = Joi.string().required()
export const description = Joi.string().required()
export const imageUrl = Joi.string().uri().required()
export const price = Joi.number().required()
export const createItem = Joi.object({
  title,
  description,
  imageUrl,
  price,
})
