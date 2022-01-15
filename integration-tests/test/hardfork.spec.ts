import { expect } from './shared/setup'

import { Contract } from 'ethers'
import { ethers } from 'hardhat'
import { OptimismEnv } from './shared/env'

const traceToGasByOpcode = (structLogs, opcode) => {
  let gas = 0
  const opcodes = []
  for (const log of structLogs) {
    if (log.op === opcode) {
      opcodes.push(opcode)
      gas += log.gasCost
    }
  }
  return gas
}

describe('Hard forks', () => {
  let env: OptimismEnv
  let SimpleStorage: Contract

  before(async () => {
    env = await OptimismEnv.new()
    const Factory__SimpleStorage = await ethers.getContractFactory(
      'SimpleStorage',
      env.l2Wallet
    )
    SimpleStorage = await Factory__SimpleStorage.deploy()
  })

  describe('Berlin', () => {
    it('should update the gas schedule', async () => {
      // Get the tip height
      const tip = await env.l2Provider.getBlock('latest')

      // send a transaction to be able to trace
      const tx = await SimpleStorage.setValueNotXDomain(`0x${'77'.repeat(32)}`)
      await tx.wait()

      // Collect the traces
      const berlinTrace = await env.l2Provider.send('debug_traceTransaction', [
        tx.hash,
      ])
      const preBerlinTrace = await env.l2Provider.send(
        'debug_traceTransaction',
        [tx.hash, { overrides: { berlinBlock: tip.number + 10 } }]
      )
      expect(berlinTrace.gas).to.not.eq(preBerlinTrace)

      const berlinSstoreCosts = traceToGasByOpcode(
        berlinTrace.structLogs,
        'SSTORE'
      )
      const preBerlinSstoreCosts = traceToGasByOpcode(
        preBerlinTrace.structLogs,
        'SSTORE'
      )
      expect(berlinSstoreCosts).to.not.eq(preBerlinSstoreCosts)
    })
  })
})
