'use strict'

import {gql} from 'apollo-server-express'

const typeDefs = gql`
  extend type Query {
    me: User!
  }

  extend type Mutation {
    signUp(
      name: String!
      email: String!
      password: String!
      confirmPassword: String!
    ): User!
    signOut: Status
    signIn(email: String!, password: String!): User!
    confirmAccount(confirmToken: String!): Status
  }

  type User {
    _id: ID!
    name: String!
    email: String!
  }
`

export default typeDefs
