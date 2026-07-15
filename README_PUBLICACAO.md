# Preparacao dos pacotes de publicacao

Este arquivo documenta o gerador local dos pacotes de publicacao do Border Value.

## Comando

```powershell
python prepare_publication_package.py
```

## Saida

O comando cria `outputs/publicacao_border_value_2026` com:

- `bases/`: bases oficiais de entrada e saidas publicaveis;
- `metadados/`: manifestos, checksums e notas de fontes/metodo;
- `dicionario_dados/`: dicionario de dados em CSV e Markdown;
- `reproducao/`: scripts, configuracoes, testes e documentacao;
- `pacotes_zip/`: arquivos compactados por bloco.

Tambem cria `outputs/publicacao_border_value_2026_completo.zip` com o pacote completo.
