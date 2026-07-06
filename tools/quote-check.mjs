import { createPublicClient, http, parseAbi, parseUnits } from 'viem';
const client=createPublicClient({transport:http('https://rpc.testnet.arc.network')});
const pool='0xca715f47b8f3dc8c4ee70e246535a4f2ad8ca167';
const usdc='0x3600000000000000000000000000000000000000';
const abi=parseAbi(['function quote(address tokenIn,uint256 amountIn) view returns (address,uint256)']);
try {
 const result=await client.readContract({address:pool,abi,functionName:'quote',args:[usdc,parseUnits('1',6)]});
 console.log(result[0], result[1].toString());
} catch(e) { console.log(e.shortMessage || e.message); }
