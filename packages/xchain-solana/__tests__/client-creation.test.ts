import Client from '../src/client'

const f = [
  {
    address: 'J8ie3Qrq58NrsAqRKw9ARMYg1wksHUJR4Fki11ic3mi1',
    seedPhrase: 'humble vapor crane armor capable rack hope amused crucial decrease tooth prosper',
  },
  {
    address: '8FbaDvRaxwbRJP84PBHtWPAe133vGUMCuWPaj6E7bZDW',
    seedPhrase: 'spoon obvious sausage first pipe milk glimpse oblige swing vicious twelve inject',
  },
]

describe('Client Creation Test', () => {
  it('should throw error on bad phrase', () => {
    expect(() => {
      new Client({ phrase: 'bad bad phrase' })
    }).toThrowError()
  })

  it('should create a wallet from phrase', () => {
    const client = new Client({
      network: 'testnet',
      phrase: f[0].seedPhrase,
    })

    expect(client).toBeInstanceOf(Client)
    expect(client.getAddress()).toEqual(f[0].address)
  })
})
