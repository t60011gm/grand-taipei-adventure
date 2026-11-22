// km/h. Taipei BOTE, 市區道路速限表 (115.2.3). Ramp and garage values are simulation defaults.
export function roadLimit(id='',kind,label=''){
 if(kind==='main'||id.startsWith('civic'))return 80
 if(kind==='cross')return label.includes('建國')?70:50
 if(kind==='ramp')return 40
 if(['lot','fork','parking'].includes(kind))return 10
 return /tourSurface|GFsurfaceC/.test(id)||label.includes('市民大道平面')?40:50
}

// Gradual, distance-based variation keeps the cruise independent of frame rate.
export function cruiseSpeed(limit,metres,offset=0){
 const spread=limit<=10?1:5
 return (limit+spread*Math.sin(metres/165+offset))/3.6
}
