import Client from '../src/client'

const tx = '5KHgvpchLtDhf1nW5N8szkQHUALmSuRRmkh6oCaHBiDZWJ3fALsZnUdYDxoYanrQ9BUSjK6hL1xD3ieBNvtX7Xni'

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

describe('Client Test', () => {
  let client: Client

  beforeEach(() => {
    client = new Client({})
  })

  it('should set new phrase', () => {
    const address = client.setPhrase(f[0].seedPhrase)
    expect(address).toEqual(f[0].address)

    const address2 = client.setPhrase(f[1].seedPhrase)
    expect(address2).toEqual(f[1].address)
  })

  it('should fail to set new phrase', () => {
    expect(() => client.setPhrase('bad bad phrase')).toThrowError()
  })

  /* eslint-disable @typescript-eslint/ban-ts-comment */

  it('should fail on bad network', () => {
    // @ts-ignore
    expect(() => client.setNetwork('badnet')).toThrowError()
  })

  it('should fail without network', () => {
    // @ts-ignore
    expect(() => client.setNetwork()).toThrowError()
  })

  /* eslint-enable @typescript-eslint/ban-ts-comment */

  it('should set network', async () => {
    expect(client.getNetwork()).toEqual('mainnet')

    client.setNetwork('testnet')
    expect(client.getNetwork()).toEqual('testnet')
  })

  it('should fail a bad address', () => {
    expect(client.validateAddress('0xBADbadBad')).toBeFalsy()
  })

  it('should pass a good address', () => {
    expect(client.validateAddress(f[0].address)).toBeTruthy()
  })

  it('should pass a good address', () => {
    expect(() => client.getAddress()).toThrowError()

    const address = client.setPhrase(f[0].seedPhrase)
    expect(address).toEqual(f[0].address)
    expect(() => client.getAddress()).not.toThrowError()

    client.purgeClient()
    expect(() => client.getAddress()).toThrowError()
  })

  // getExplorerUrl
  // getExplorerAddressUrl
  // getExplorerTxUrl

  it('should provide ExplorerUrl for mainnet', () => {
    expect(client.getExplorerUrl()).toEqual('https://explorer.solana.com/')
  })

  it('should provide getExplorerAddressUrl for mainnet', () => {
    expect(client.getExplorerAddressUrl(f[0].address)).toEqual('https://explorer.solana.com/address/' + f[0].address)
  })

  it('should provide ExplorerTxUrl for mainnet', () => {
    expect(client.getExplorerTxUrl(tx)).toEqual('https://explorer.solana.com/tx/' + tx)
  })

  it('should provide ExplorerUrl for testnet', () => {
    client.setNetwork('testnet')
    expect(client.getExplorerUrl()).toEqual('https://explorer.solana.com/' + '?cluster=testnet')
  })

  it('should provide getExplorerAddressUrl for testnet', () => {
    client.setNetwork('testnet')
    expect(client.getExplorerAddressUrl(f[0].address)).toEqual(
      'https://explorer.solana.com/address/' + f[0].address + '?cluster=testnet',
    )
  })

  it('should provide ExplorerTxUrl for testnet', () => {
    client.setNetwork('testnet')
    expect(client.getExplorerTxUrl(tx)).toEqual('https://explorer.solana.com/tx/' + tx + '?cluster=testnet')
  })
})
