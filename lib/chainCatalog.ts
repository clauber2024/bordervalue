export type ChainStatus = "published" | "development";

export type ChainCatalogItem = {
  id: string;
  name: string;
  group: string;
  description: string;
  status: ChainStatus;
};

export const chainCatalog: readonly ChainCatalogItem[] = [
  { id: "silicio", name: "Silício e Solar Fotovoltaica", group: "Geração renovável", description: "Quartzo, silício metalúrgico, polissilício, wafers, células e módulos.", status: "published" },
  { id: "combustiveis_transicao", name: "Combustíveis de Transição", group: "Combustíveis de baixo carbono", description: "Etanol, biometano, metanol, SAF e combustíveis marítimos.", status: "published" },
  { id: "fertilizantes", name: "Fertilizantes Estratégicos", group: "Segurança produtiva", description: "Nitrogenados, fosfatados, potássicos e insumos agroindustriais.", status: "published" },
  { id: "aco", name: "Aço e Materiais Estratégicos", group: "Descarbonização industrial", description: "Siderurgia, ligas e materiais para infraestrutura de transição.", status: "published" },
  { id: "hidrogenio_derivados", name: "Hidrogênio e Derivados", group: "Moléculas verdes", description: "Hidrogênio, amônia, metanol e combustíveis sintéticos.", status: "development" },
  { id: "eolica", name: "Energia Eólica", group: "Geração renovável", description: "Torres, nacelles, geradores, pás e ímãs permanentes.", status: "development" },
  { id: "baterias", name: "Baterias e Armazenamento", group: "Armazenamento", description: "Lítio, grafite, cátodos, células e integração de packs.", status: "development" },
  { id: "redes_eletricas", name: "Redes Elétricas", group: "Infraestrutura", description: "Transformadores, cabos, inversores e equipamentos de potência.", status: "development" },
  { id: "minerais_criticos", name: "Minerais Críticos", group: "Materiais estratégicos", description: "Lítio, cobre, níquel, grafite, terras raras e nióbio.", status: "development" },
  { id: "captura_carbono", name: "Captura e Uso de Carbono", group: "Descarbonização industrial", description: "Equipamentos, solventes, transporte, armazenamento e utilização.", status: "development" },
] as const;

