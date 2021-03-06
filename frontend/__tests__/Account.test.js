import {render, fireEvent, waitFor} from '@testing-library/react'
import {MockedProvider} from '@apollo/react-testing'
import {GraphQLError} from 'graphql'

import {Account} from '#root/pages/account'
import ME_QUERY from '#root/graphql/me.query'
import REQUEST_CONFIRM_MUTATION from '#root/graphql/requestConfirm.mutation'
import {fakeUser} from '#root/utils/testUtils'

const user = fakeUser()

const signedInMock = {
  request: {query: ME_QUERY},
  result: jest.fn(() => ({data: {me: user}})),
}

const signedErrorMock = {
  request: {query: ME_QUERY},
  result: jest.fn(() => ({
    errors: [new GraphQLError('Error')],
  })),
}

const notConfirmedMock = {
  request: {query: ME_QUERY},
  result: jest.fn(() => ({data: {me: {...user, confirmed: false}}})),
}

const requestConfirmMock = {
  request: {query: REQUEST_CONFIRM_MUTATION},
  result: jest.fn(() => ({
    data: {requestConfirm: {status: 'Status', message: 'Message'}},
  })),
}

test('initial state of loading', async () => {
  const {getByText} = render(
    <MockedProvider mocks={[signedInMock]} addTypename={false}>
      <Account />
    </MockedProvider>,
  )

  expect(getByText(/loading account/i)).toBeInTheDocument()

  await waitFor(() => {
    expect(signedInMock.result).toHaveBeenCalled()
  })

  signedInMock.result.mockClear()
})

test('renders error on graphql error', async () => {
  const {getByText} = render(
    <MockedProvider mocks={[signedErrorMock]} addTypename={false}>
      <Account />
    </MockedProvider>,
  )

  await waitFor(() => {
    expect(getByText(/failed to load account information/i)).toBeInTheDocument()
    expect(signedErrorMock.result).toHaveBeenCalled()
  })
})

test('renders account information', async () => {
  const {getByText} = render(
    <MockedProvider mocks={[signedInMock]} addTypename={false}>
      <Account />
    </MockedProvider>,
  )

  await waitFor(() => {
    expect(getByText(/welcome/i)).toBeInTheDocument()
    expect(getByText(user.name)).toBeInTheDocument()
    expect(getByText(user.email)).toBeInTheDocument()
    expect(signedInMock.result).toHaveBeenCalled()
  })
})

test('success confirmed button when email has been confirmed', async () => {
  const {getByTestId} = render(
    <MockedProvider mocks={[signedInMock]} addTypename={false}>
      <Account />
    </MockedProvider>,
  )

  await waitFor(() => {
    const button = getByTestId('button')

    expect(button).toHaveClass('success')
    expect(button).toBeDisabled()
    expect(button.textContent).toEqual('Confirmed')
    expect(button.title).toEqual('Email has been confirmed')
  })
})

test('negative confirmed button when email has not been confirmed', async () => {
  const {getByTestId} = render(
    <MockedProvider
      mocks={[notConfirmedMock, requestConfirmMock]}
      addTypename={false}
    >
      <Account />
    </MockedProvider>,
  )

  await waitFor(() => {
    const button = getByTestId('button')
    expect(button).toHaveClass('failure')
    expect(button).toBeEnabled()
    expect(button.textContent).toEqual('Not Confirmed')
    expect(button.title).toEqual('Click to resend email confirmation')
  })
})

test('negative confirmed button onclick should call requestConfirm mutation', async () => {
  const {findByTestId} = render(
    <MockedProvider
      mocks={[notConfirmedMock, requestConfirmMock]}
      addTypename={false}
    >
      <Account />
    </MockedProvider>,
  )

  const button = await findByTestId('button')
  fireEvent.click(button)

  await waitFor(() => {
    expect(button).toBeDisabled()
    expect(button.textContent).toEqual('Email sent!')
    expect(requestConfirmMock.result).toHaveBeenCalled()
  })
})
