export const transitionFuelDestinationByStage: Record<string, string> = {
  aplicacoes_finais: "Aviação · SAF",
  derivados: "Transporte marítimo e combustíveis sintéticos",
  molecula_principal: "Transporte rodoviário e uso industrial",
  insumos: "Produção de biocombustíveis e biometano",
  insumos_tecnologicos: "Conversão e refino de baixo carbono",
  equipamentos: "Hidrogênio e e-combustíveis",
};

export const transitionFuelDestinations = Object.values(transitionFuelDestinationByStage);

export function transitionFuelDestination(stage: string) {
  return transitionFuelDestinationByStage[stage] ?? "Aplicações de baixo carbono a homologar";
}
