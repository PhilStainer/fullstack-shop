import styled from 'styled-components'

const Title = styled.h1`
  font-size: 50px;
  color: ${({theme}) => theme.red};
`

export default () => <Title>My page</Title>
