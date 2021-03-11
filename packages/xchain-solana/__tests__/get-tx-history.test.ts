import Client from '../src/client'

describe('Client getTransactions', () => {
  it('fails with other asset', () => {
    const client = new Client({})

    expect(() => client.getTransactions()).rejects.toMatchObject({ message: 'Phrase must be provided' })
  })
})
