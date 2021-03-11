import Client from '../src/client'

import { AssetBTC } from '@xchainjs/xchain-util'

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

describe('Client getBalance', () => {
  it('fails with other asset', () => {
    const client = new Client({})

    expect(() => client.getBalance(f[0].address, [AssetBTC])).rejects.toMatchObject({ message: 'Unsupported asset' })
  })
})
