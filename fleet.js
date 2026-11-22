export const types=[
 {name:'sedan',length:4.38,width:1.82,height:1.45},
 {name:'hatch',length:3.88,width:1.76,height:1.52},
 {name:'suv',length:4.72,width:1.91,height:1.78},
 {name:'van',length:5.08,width:1.95,height:2.05},
 {name:'bus',length:10.8,width:2.48,height:3.14},
 {name:'scooter',length:1.82,width:.72,height:1.63}
]

export const scooterPaints=[0xce3548,0xf18533,0xe3bb38,0x45a26c,0x21adae,0x387ccb,0x805bc0,0xda79a0,0xe6e4d7,0x455161]
export const riderShirts=[0xee635b,0xf6a541,0xe8c442,0x539a70,0x32abaf,0x5195d8,0xa47bd0,0xe78aaf]
export const riderHelmets=[0xece4d7,0x274459,0xcee264,0xb94e45,0x2f9f99,0x9164b4]
export function randomizeScooter(c){
 const choose=list=>Math.floor(Math.random()*list.length)
 c.paint=choose(scooterPaints)
 c.female=Math.random()<.5
 c.shirt=riderShirts[choose(riderShirts)]
 c.helmet=riderHelmets[choose(riderHelmets)]
}
