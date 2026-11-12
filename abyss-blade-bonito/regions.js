// Each remote region is reached through a physical doorway. The large gaps
// between coordinate blocks are outside the playable rooms.
const floor=(x,end,y,kind='ruin')=>({x,y:y-3,w:end-x,h:3,kind});
const ledge=(x,w,y,kind='ruin')=>({x,y:y-.24,w,h:.24,kind,oneWay:true});
const wall=(x,y,h,kind='ruin')=>({x,y,w:.8,h,kind});
const foe=(id,type,x,y,left,right,hp)=>({id,type,x,y,left,right,hp});
const item=(id,type,x,y)=>({id,type,x,y});
const at=(x,y)=>({x,y});
const door=(id,name,x,y,destX,destY,requires)=>({id,name,x,y,to:at(destX,destY),requires});

export const regions={
  width:485,
  platforms:[
    floor(284,300,.37),floor(309,317,.37),floor(299.75,309.25,-7.7,'cave'),
    wall(299.2,-7.45,7.82,'cave'),wall(309,-7.45,7.82,'cave'),wall(316.6,.37,20),
    ledge(283,3.9,1.92),ledge(286.9,4,3.47),ledge(291,4.4,5.02),ledge(301,2.55,-6.15,'cave'),ledge(305.8,2.85,-4.60,'cave'),
    ledge(301,2.55,-3.05,'cave'),ledge(305.8,2.85,-1.50,'cave'),ledge(301,2.55,.02,'cave'),
    floor(335,367,.35,'cyan'),wall(334.2,-2.65,21),wall(367,-2.65,21),
    ledge(338,4,1.95,'cyan'),ledge(342.1,5,3.5,'cyan'),ledge(347.2,4.4,5.05,'cyan'),
    ledge(351.6,5,6.60,'cyan'),ledge(356.6,5.1,8.15,'cyan'),ledge(361.7,5.25,9.70,'cyan'),
    ledge(357.5,5.2,11.25,'cyan'),ledge(351.2,4.5,12.80,'cyan'),ledge(346.4,4.9,14.35,'cyan'),
    floor(387,396,-4.9,'cave'),floor(395.8,417,-11.25,'cave'),floor(417,422,-10.05,'cave'),
    floor(422,426,-8.85,'cave'),floor(426,431,-7.65,'cave'),wall(386.2,-14,25,'cave'),wall(431,-12,21,'cave'),
    ledge(396.2,4,-6.45,'cave'),ledge(400.3,4,-7.95,'cave'),ledge(404.4,3.8,-9.50,'cave'),
    ledge(409.3,4.8,-9.65,'cave'),ledge(415,4,-8.52,'cave'),ledge(419.2,3.7,-7.30,'cave'),
    floor(449,483,.28),wall(448.2,-2.72,16),wall(483,-2.72,16),
    ledge(452,4,1.83),ledge(457,4.7,3.38),ledge(462,4.7,4.93),ledge(469,4,2.01),ledge(475,4,2.5),
  ],
  zones:[
    {x:284,name:'Cruce de las Linternas',network:true,mapY:112},
    {x:333,name:'Campanario de Vidrio',network:true,mapY:66},
    {x:385,name:'Galerías del Osario',network:true,mapY:168},
    {x:448,name:'Archivo del Ocaso',network:true,mapY:112},
  ],
  stations:[
    {id:'crossing',name:'Cruce de las Linternas',x:287,y:.37},
    {id:'spire',name:'Campanario de Vidrio',x:343.5,y:3.5},
    {id:'ossuary',name:'Galerías del Osario',x:407,y:-11.25},
    {id:'archive',name:'Archivo del Ocaso',x:453.5,y:.28},
  ],
  merchants:[{x:44,y:.4,name:'Nara'},{x:290.7,y:.37,name:'Nara'}],
  portals:[
    door('up','Subir al campanario',293,5.02,336.7,.35),
    door('down','Descender al osario',305.5,-7.7,390,-4.9),
    door('archive','Entrar al Archivo del Ocaso',313,.37,450.6,.28,['bell','bone']),
    door('spire-back','Volver al cruce',336.7,.35,293,5.02),
    door('spire-short','Atajo a las linternas',364.9,9.70,293,5.02,['bell']),
    door('ossuary-back','Volver al pozo',390,-4.9,305.5,-7.7),
    door('ossuary-short','Atajo al puente',428.5,-7.65,312,.37,['bone']),
    door('archive-back','Volver al cruce',450.6,.28,313,.37),
  ],
  relics:[
    {id:'bell',name:'Sello del Cristal',x:348.7,y:14.35,icon:'◇'},
    {id:'bone',name:'Sello de Hueso',x:411.9,y:-9.65,icon:'✧'},
  ],
  pickups:[
    item('junction-fruit','apple',296.5,.83),item('spire-crystal1','crystal',349.7,5.49),
    item('spire-fruit','apple',359.4,8.59),item('spire-crystal2','crystal',353.4,13.24),
    item('ossuary-fruit','apple',406,-10.81),item('ossuary-crystal','crystal',420.2,-6.86),
    item('archive-fruit','apple',455.4,2.27),item('archive-crystal','crystal',464.3,5.37),
  ],
  enemies:[
    foe('glass-moth-1','moth',348.8,5.45,346.9,351.5,4),
    foe('glass-archer-1','sentry',354.3,6.60,351.9,356.2,4),
    foe('glass-moth-2','moth',359.2,9.5,356.7,362.3,5),
    foe('glass-archer-2','sentry',354.1,12.80,351.5,355.4,5),
    foe('ossuary-leaper-1','hopper',401.3,-11.25,397.5,405.2,4),
    foe('ossuary-archer','sentry',411.9,-11.25,409.1,415.3,4),
    foe('ossuary-leaper-2','hopper',419.3,-10.05,417.3,421.7,5),
    foe('ossuary-moth','moth',424,-6.8,421.6,426.5,5),
    foe('archive-moth','moth',458.8,4.1,457,462.1,5),
    foe('archive-leaper','hopper',462,.28,459,466,5),
    foe('archive-keeper','curator',475.5,.28,468.8,480.1,12),
  ],
  checkpoints:[at(286,.37),at(343.5,3.5),at(407,-11.25),at(453.5,.28)],
  lighting:[
    {x:334,end:370,fadeIn:2,fadeOut:3,darkness:.34,palette:'cyan'},
    {x:386,end:433,fadeIn:2,fadeOut:3,darkness:.82,palette:'cave'},
  ],
  exit:at(481,.28),
  keeper:'archive-keeper',
};
