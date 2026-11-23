export function path(points){
 const p=[points[0]],s=[0]
 for(const b of points.slice(1)){
  const a=p.at(-1),d=Math.hypot(...a.map((v,i)=>b[i]-v))
  if(d>.001){p.push(b);s.push(s.at(-1)+d)}
 }
 return {p,s,length:s.at(-1)}
}
export function point(lane,m){
 const {p,s}=lane
 let lo=0,hi=s.length-1
 while(hi-lo>1){const k=(lo+hi)>>1;if(s[k]<=m)lo=k;else hi=k}
 const a=p[lo],b=p[hi],f=Math.min(1,Math.max(0,(m-s[lo])/(s[hi]-s[lo])))
 return {x:a[0]+(b[0]-a[0])*f,n:a[1]+(b[1]-a[1])*f,h:a[2]+(b[2]-a[2])*f,
  angle:Math.atan2(b[1]-a[1],b[0]-a[0]),slope:Math.atan2(b[2]-a[2],Math.hypot(b[0]-a[0],b[1]-a[1])),i:hi}
}
