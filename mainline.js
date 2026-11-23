// Directions are the receiving carriageways. The same paths drive the guide and traffic.
import {path,point} from './lane-geometry.js'
const movements=[
 ['新生南路｜市民西向','civic1',['civic1'],['51362366']],
 ['八德路｜新生北向','新生北向',['51362361','260152357'],['51362398','1132433053']],
 ['長安東路｜新生南向','新生南向',['50289495','1079151555','244450513'],['51362434','1132431141']],
 ['建國南路｜市民東向','civic-1',['civic-1'],['49073263']],
 ['忠孝東路｜建國北向','建國北向',['910567292','910567291'],['49073297']],
 ['長安東路｜建國南向','建國南向',['910959595','252657373','252657374'],['49710834']]
]
export function mainlineMovements(lanes){
 const result=[]
 for(const [label,id,mainIds,rampIds] of movements){
  if(![...mainIds,...rampIds].every(k=>lanes[k]))continue
  const points=mainIds.flatMap(k=>lanes[k])
  const main=path(id==='civic1'?points.reverse():points)
  const approach=path(rampIds.flatMap(k=>lanes[k])),end=approach.p.at(-1)
  const nearest=main.p.reduce((best,p,i)=>Math.hypot(...p.map((v,k)=>v-end[k]))<Math.hypot(...main.p[best].map((v,k)=>v-end[k]))?i:best,0)
  const at=main.s[nearest],join=point(main,at)
  const tail=main.p.slice(nearest+1).map((p,i)=>{
   const t=Math.min(1,(main.s[nearest+i+1]-at)/32)
   return p.map((v,k)=>v+(end[k]-main.p[nearest][k])*(1-t*t*(3-2*t)))
  })
  const lane=path([...approach.p,...tail])
  lane.id='entry-'+rampIds.at(-1)
  const start=main.s.findIndex(m=>m>=Math.max(35,at-172))
  const finish=main.s.findIndex(m=>m>=at+135)
  const leg=path(main.p.slice(start,finish<0?undefined:finish+1))
  Object.assign(leg,{id,label,kind:id.startsWith('civic')?'main':'cross',mainStart:main.s[start],startSpeed:id.includes('新生')?14:18,visit:true,transfer:result.length>0})
  result.push({id,mainIds,lane,main,join,at,mergeAt:approach.length,leg})
 }
 return result
}
