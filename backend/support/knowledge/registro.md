# JL Registry

O JL Registry é o registro oficial de bibliotecas da JLScript. Ele permite criar conta, publicar pacotes, acompanhar downloads e consultar versões.

## Publicação

Crie uma pasta com `jls new folder Math`. O pacote precisa ter `Math.jls`, um bloco `info{}` e `class Pack{}`. Em seguida use `jls Math update`, compile localmente e execute `jls Math publish` depois de configurar a integração do Registry.

## Atualização

Atualizações criam uma nova versão e mantêm as anteriores. Altere a versão no bloco `info{}` antes de executar `jls Math update`.

## Instalação e pesquisa

Use `jls search math` para pesquisar e `jls install math` para instalar uma biblioteca publicada.
