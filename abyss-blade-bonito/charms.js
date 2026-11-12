export const capacity=4;
export const charms=[
 {id:'seed',name:'Semilla de Vigilia',price:25,slots:1,icon:'✦',color:'#b4d59d',description:'Conserva el calor del primer bosque.',effect:'Aumenta en 2 la vida máxima.',mods:{health:2}},
 {id:'fang',name:'Colmillo de Umbría',price:45,slots:2,icon:'◈',color:'#e1a5b5',description:'El filo recuerda cada batalla.',effect:'La Espada del Abismo inflige 1 punto más de daño.',mods:{damage:1}},
 {id:'spore',name:'Espora Errante',price:35,slots:1,icon:'❖',color:'#a0d7ca',description:'Una semilla que nunca llega a tocar la tierra.',effect:'Tom corre un 18 % más rápido.',mods:{speed:.18}},
 {id:'vessel',name:'Vasija del Eco',price:40,slots:1,icon:'⬡',color:'#aebcf1',description:'Guarda los ecos perdidos entre los golpes.',effect:'Cada ataque consume 5 puntos menos de energía.',mods:{attackDiscount:5}},
 {id:'wing',name:'Ala de Cristal',price:70,slots:2,icon:'◒',color:'#c0e9f0',description:'Una polilla dejó su última ala en el campanario.',effect:'Permite saltar una segunda vez en el aire.',mods:{doubleJump:true}},
 {id:'thorn',name:'Espina de Nácar',price:55,slots:2,icon:'⟡',color:'#dec6f3',description:'La raíz crece hasta alcanzar su objetivo.',effect:'Amplía el alcance de la espada.',mods:{reach:.52}},
];
const byId=new Map(charms.map(c=>[c.id,c]));
export const charmById=id=>byId.get(id);
const nuxRewards={shade:12,stalker:16,warden:24,moth:20,hopper:18,sentry:22,curator:75};
export const nuxReward=type=>nuxRewards[type]??12;
export function createPurse(){
  let nux=0;const owned=new Set(),equipped=new Set();
  const used=()=>[...equipped].reduce((n,id)=>n+byId.get(id).slots,0);
  function buy(id){const c=byId.get(id);if(!c||owned.has(id)||nux<c.price)return false;nux-=c.price;owned.add(id);return true;}
  function equip(id){
    const c=byId.get(id);if(!c||!owned.has(id))return 'unowned';
    if(equipped.delete(id))return 'removed';
    if(used()+c.slots>capacity)return 'full';
    equipped.add(id);return 'equipped';
  }
  function stats(){return Object.assign({},...[...equipped].map(id=>byId.get(id).mods));}
  function restore(data={}){
    nux=Number.isSafeInteger(data.nux)&&data.nux>=0?data.nux:0;
    owned.clear();equipped.clear();
    for(const c of charms)if(data.owned?.includes(c.id))owned.add(c.id);
    for(const c of charms)if(data.equipped?.includes(c.id)&&owned.has(c.id))equip(c.id);
  }
  return {owned,equipped,used,buy,equip,stats,restore,
    reward(type){const value=nuxReward(type);nux+=value;return value;},
    snapshot(){return {nux,owned:[...owned].sort(),equipped:[...equipped].sort()};},
    get nux(){return nux;}
  };
}
