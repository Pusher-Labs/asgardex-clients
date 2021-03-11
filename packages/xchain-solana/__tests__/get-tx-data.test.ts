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

describe('Client getTransactionData', () => {
  it('fails with other asset', () => {
    const client = new Client({})

    expect(() => client.getTransactionData(f[0].address, f[1].address)).rejects.toMatchObject({
      message: 'Unsupported asset',
    })
  })
})
