"""Bake lane-centred tour paths with clearance for a 4.38 m by 2.181 m car."""
import csv
import json
from pathlib import Path
import numpy as np

root = Path(__file__).resolve().parents[1]
assets = root / 'assets'
def read(name):
    return json.loads((assets / (name + '.json')).read_text())
city, west, network = map(read, ['city','route','transport'])
profile = np.array(west['profile'] + city['profile'])
def ground(x):
    return profile[np.clip(np.rint(x-west['start']).astype(int),0,len(profile)-1),1]

# Collision centres in route/city use south-positive Z. Transport uses north-positive Y.
circles=[]
with (root/'墩頂與梁底接合檢查.csv').open(encoding='utf-8-sig') as f:
    supports=np.array([[float(v) for v in row[1:5]] for row in list(csv.reader(f))[1:]])
for x,y,r in network['piers']:
    i=np.argmin(np.hypot(supports[:,0]-x,supports[:,1]-y))
    z=ground(x)
    top=supports[i,3]-1.45 if np.hypot(supports[i,0]-x,supports[i,1]-y)<1 else z+3.2
    circles.append([x,y,r,z-.72,top])
for x,y,r in network['parked']+[[x,-z,r] for x,z,r in west['columns']+city['columns']]:
    g=ground(x)
    circles.append([x,y,r,g-.05,g+2.6])
circles=np.array(circles)
boxes=np.array(network['solids'])
roads=[r.copy() for r in network['roads'] if r['kind']!='footway']
for side in [-1,1]:
    p=[]
    for i in range(5,len(profile)-5):
        north,h,sw,nw=profile[i,:4]
        p.append([west['start']+i,north+side*min((sw if side<0 else nw)-1.5,12),h])
    roads.append(dict(id='tourSurface'+str(side),kind='surface',p=p,w=8.8,lanes=1))

def make_path(r, margin):
    p=np.array(r['p'])
    if r['id']=='lotaccess1-1':
        # Approach from the aisle around the column at the T-junction.
        p=np.vstack(([1050.8,580.8,-1.55],[1052.0,578.8,-1.55],[1052.1,577.4,-1.55],[1051.8,575.7,-1.55],p[1:]))
    # Sample before testing; the input includes unequal survey intervals.
    dist=np.r_[0,np.cumsum(np.linalg.norm(np.diff(p,axis=0),axis=1))]
    s=np.linspace(0,dist[-1],int(np.ceil(dist[-1]/.68))+1)
    q=np.stack([np.interp(s,dist,p[:,j]) for j in range(3)],axis=1)
    if r['kind']=='surface' and len(q)>14:
        # Round surveyed junction vertices within the carriageway. Keep both mouths fixed.
        for k in (0,1):
            soft=np.convolve(np.pad(q[:,k],5,mode='edge'),np.ones(11)/11,'valid')
            blend=np.minimum(1,np.minimum(s,s[-1]-s)/3.5)
            q[:,k]+=(soft-q[:,k])*blend
    direction=np.gradient(q[:,:2],axis=0)
    direction/=np.maximum(1e-8,np.linalg.norm(direction,axis=1))[:,None]
    u,v=direction.T
    w=np.interp(s,dist,r.get('widths',[r['w']]*len(p)))
    n=r.get('lanes',1)
    pref=np.zeros(len(q))
    if r['kind']=='main':
        pref=(1 if r['id']=='civic1' else -1)*(w/2-1.82)
    elif r['id']=='GFsurfaceB':
        pref-=3.3
    elif r['id']=='guangfuReturn':
        pass # Already a traced driving line through the junction and U-turn.
    elif r['id'].startswith('GFsurfaceC'):
        pref+= -2.7 if r['id'].endswith('1') and '-' not in r['id'] else 2.7
    elif n%2==0:
        pref-=w/(2*n)
    offsets=np.arange(-int(max(w)/2/.17),int(max(w)/2/.17)+1)*.17
    X=q[:,0,None]-v[:,None]*offsets
    Y=q[:,1,None]+u[:,None]*offsets
    ok=np.broadcast_to(abs(offsets)<=w[:,None]/2-1.16,X.shape).copy()
    if r['id'].startswith('tourSurface'):
        side=-1 if r['id'].endswith('-1') else 1
        ii=np.clip(np.rint(X-west['start']).astype(int),0,len(profile)-1)
        lateral=side*(Y-profile[ii,0])
        ok &= (lateral>=2.7)&(lateral<=profile[ii,2 if side<0 else 3]-1.15)
    ext=1+w.max()/2+3
    def candidates(obs,radius):
        return np.flatnonzero((obs[:,0]+radius>=q[:,0].min()-ext)&(obs[:,0]-radius<=q[:,0].max()+ext)&(obs[:,1]+radius>=q[:,1].min()-ext)&(obs[:,1]-radius<=q[:,1].max()+ext))
    for i in candidates(circles,circles[:,2]):
        x,y,rad,low,high=circles[i]
        rows=np.flatnonzero((abs(q[:,0]-x)<ext+rad)&(abs(q[:,1]-y)<ext+rad)&(q[:,2]+1.25>low)&(q[:,2]<high))
        dx=X[rows]-x;dy=Y[rows]-y
        along=abs(dx*u[rows,None]+dy*v[rows,None])
        cross=abs(-dx*v[rows,None]+dy*u[rows,None])
        ok[rows] &= np.hypot(np.maximum(0,along-2.36),np.maximum(0,cross-1.19))>rad+margin
    for i in candidates(boxes,np.hypot(boxes[:,4],boxes[:,5])):
        x,y,nx,ny,hw,hl=boxes[i]
        rows=np.flatnonzero((abs(q[:,0]-x)<ext+abs(nx)*hw+abs(ny)*hl)&(abs(q[:,1]-y)<ext+abs(ny)*hw+abs(nx)*hl)&(abs(q[:,2]-ground(x))<2.7))
        dx=X[rows]-x;dy=Y[rows]-y
        dot=abs(nx*u[rows,None]+ny*v[rows,None]);perp=abs(nx*v[rows,None]-ny*u[rows,None])
        ok[rows]&=((abs(dx*nx+dy*ny)>hw+2.40*dot+1.36*perp)|(abs(-dx*ny+dy*nx)>hl+2.40*perp+1.36*dot)|(abs(dx*u[rows,None]+dy*v[rows,None])>2.40+hw*dot+hl*perp)|(abs(-dx*v[rows,None]+dy*u[rows,None])>1.36+hw*perp+hl*dot))
    # Prefer a marked lane for the entire run. Only leave its centre where clearance requires it.
    error=abs(offsets-pref[:,None])
    lane_error=error
    if n>1 and not r['id'].startswith('GFsurface') and r['id']!='guangfuReturn' and r['kind']!='main':
        lane_error=np.min([abs(offsets-(-w/2+(i+.5)*w/n)[:,None]) for i in range(n)],axis=0)
    single=ok.all(axis=0)&(lane_error.mean(axis=0)<.30)
    nearest=np.argmin(error,axis=1)
    if np.all(ok[np.arange(len(q)),nearest]):
        off=offsets[nearest] if np.ptp(pref)<.01 else pref
    elif np.any(single):
        idx=np.argmin(np.where(single,np.mean((offsets-pref[:,None])**2,axis=0),np.inf))
        off=np.full(len(q),offsets[idx])
    else:
        cost=lane_error**2*.12+error**2*.012
        prev=np.where(ok[0],cost[0],np.inf);parents=np.zeros(ok.shape,np.int8)
        for j in range(1,len(q)):
            options=np.stack([np.r_[prev[1:],np.inf]+3,prev,np.r_[np.inf,prev[:-1]]+3])
            k=np.argmin(options,axis=0)
            prev=np.where(ok[j],options.min(axis=0)+cost[j],np.inf)
            parents[j]=1-k
            if not np.isfinite(prev).any():
                return None
        idx=np.argmin(prev);off=np.empty(len(q))
        for j in reversed(range(len(q))):
            off[j]=offsets[idx];idx+=parents[j,idx]
        # Round the start/end of lateral changes while retaining surveyed clearance.
        smooth=np.convolve(np.pad(off,6,mode='edge'),np.ones(13)/13,'valid')
        use=abs(smooth-off)<.17
        off[use]=smooth[use]
    q[:,0]-=v*off;q[:,1]+=u*off
    return q.round(4).tolist()
if __name__=='__main__':
    out={}
    for road in roads:
        path=make_path(road,.60)
        if path is None:
            path=make_path(road,.35)
        if path is None:
            print('Blocked:',road['id'])
        if path:out[road['id']]=path
    print('planned',len(out),'/',len(roads))
    if len(out)!=len(roads):
        raise SystemExit('At least one road has no clear path')
    # Lane selection runs per road. Carry the incoming lateral offset through
    # splits of a one-way viaduct, then ease into its new lane centre.
    elevated=[road for road in roads if road['kind']=='cross']
    for upstream in elevated:
        for downstream in elevated:
            if upstream['p'][-1]!=downstream['p'][0]:
                continue
            path=np.asarray(out[downstream['id']])
            offset=np.asarray(out[upstream['id']][-1])-path[0]
            distance=np.r_[0,np.cumsum(np.linalg.norm(np.diff(path[:,:2],axis=0),axis=1))]
            t=np.clip(distance/36,0,1)
            out[downstream['id']]=(path+(1-t*t*(3-2*t))[:,None]*offset).round(4).tolist()
    (assets/'tour-lanes.json').write_text(json.dumps(out,separators=(',',':')))
