// Hosted builds can share the public asset directory; local development uses the original files.
const published=document.querySelector('meta[name="published-assets"]')
const base=new URL(published?.content??'./assets/',document.baseURI)
export const assetURL=name=>new URL(name,base).href
export async function geometryBytes(name){
 const url=assetURL(name+(published?'.gz':''))
 const response=await fetch(url)
 if(!response.ok)throw Error('模型下載失敗 '+name+' ('+response.status+')')
 if(!published)return response.arrayBuffer()
 // Some hosts decode .gz files in transit. Inspect the signature before inflating.
 const blob=await response.blob(),signature=new Uint8Array(await blob.slice(0,2).arrayBuffer())
 return signature[0]===31&&signature[1]===139
  ?new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
  :blob.arrayBuffer()
}
