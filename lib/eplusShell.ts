// Altura fixa (px) da faixa institucional sticky do Instituto E+
// (components/InstituteShell.tsx). Fonte única de verdade para todo header,
// painel lateral e âncora de rolagem do dashboard que precisa empilhar ou
// deslocar-se logo abaixo dela.
//
// Vive num módulo neutro (sem "use client" nem next/font/google) porque é
// importada tanto por Server Components quanto por Client Components — se
// morasse dentro de InstituteShell.tsx, importar a constante a partir de um
// Client Component arrastaria o carregamento de fonte para o bundle do
// cliente e quebrava a fronteira server/client.
export const EPLUS_SHELL_HEIGHT_PX = 52;
