const PLACE_LABELS={colina:'Colina',parque:'Parque',leitura:'Cantinho de Leitura',jardim:'Jardim',observatorio:'Observatório'};

export function worldContinuityLine(fromPlace,toPlace,{preference=null,petName='Pipo'}={}){
  if(!fromPlace||!toPlace||fromPlace===toPlace)return '';
  const from=PLACE_LABELS[fromPlace]||fromPlace;
  const lines={
    'plant-carer':toPlace==='jardim'?petName+' ainda estava pensando no que viu no '+from+', mas já quer conferir a plantinha.':'',
    'tree-explorer':toPlace==='jardim'?petName+' trouxe a curiosidade do '+from+' e já está procurando novidade perto da árvore.':'',
    'story-inventor':toPlace==='leitura'?petName+' trouxe uma ideia do '+from+' e parece querer transformar isso em história.':'',
    'memory-reader':toPlace==='leitura'?petName+' ainda lembra do '+from+' e parece querer ligar esse momento a alguma história daqui.':'',
    'comet-chaser':toPlace==='observatorio'?petName+' saiu do '+from+' ainda atento e agora quer ver se algo cruza o céu.':'',
    'star-seeker':toPlace==='observatorio'?petName+' trouxe a calma do '+from+' para escolher uma estrela e observar.':'',
    'achievement-collector':toPlace==='parque'?petName+' chegou do '+from+' querendo rever as conquistas guardadas no Parque.':'',
    'treasure-storyteller':toPlace==='parque'?petName+' veio do '+from+' pensando em qual Tesouro conta a melhor história.':'',
    'cozy-home':toPlace==='colina'?petName+' voltou do '+from+' com vontade de ficar um pouco no cantinho tranquilo.':'',
    'home-decorator':toPlace==='colina'?petName+' voltou do '+from+' reparando em como a Colina está ficando com cara de casa.':''
  };
  return lines[preference?.id]||petName+' veio do '+from+' e agora está explorando '+(PLACE_LABELS[toPlace]||toPlace)+'.';
}