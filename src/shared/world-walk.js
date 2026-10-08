export function clamp(value,min,max){
  return Math.min(max,Math.max(min,value));
}

export function worldObjectTarget({
  sceneWidth=0,
  petWidth=0,
  objectCenterX=0,
  edgePadding=12,
  standOffRatio=.42
}={}){
  const scene=Math.max(1,Number(sceneWidth)||1);
  const pet=Math.max(1,Number(petWidth)||1);
  const center=scene/2;
  const obj=clamp(Number(objectCenterX)||center,0,scene);
  const standOff=pet*standOffRatio;
  const raw=obj<center?obj+standOff:obj-standOff;
  const half=pet/2;
  const min=edgePadding+half*.72;
  const max=scene-edgePadding-half*.72;
  const x=clamp(raw,Math.min(min,center),Math.max(max,center));
  return {
    x,
    direction:x<center?'left':x>center?'right':'center',
    distance:Math.abs(x-center)
  };
}
