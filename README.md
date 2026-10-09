# Sabadou — site oficial atual

Esta pasta contém a versão antiga que está sendo usada pelo público, com as correções nos sistemas que ela já oferece.

## Publicar no Git

Copie **todo o conteúdo desta pasta** para a raiz do repositório que publica o site oficial. O `index.html` já é o arquivo correto; não precisa renomear nada. Preserve os nomes e a estrutura das subpastas.

## O que esta versão oferece

- Início, avisos, música, galeria e área dos calabresos.
- Sabadou Run e Sabadômetro simples, com progresso local.
- Login administrativo, edição dos avisos e controle de manutenção.
- Sons dos botões, abas, Sabadômetro, digitação e jogo.
- Fanarts continuam como “em breve”.

A pasta não inclui envio de fanarts, contas de fãs, lojinha, rankings, avisos em vídeo ou arquivos dessas funções. Todos os arquivos necessários para a interface são locais nesta pasta; o login, os avisos remotos e a manutenção usam o projeto Supabase indicado em `config.js`.

Esta versão funciona sem depender de `../site-atualizacao/` ou `../motions/`. Alterações feitas nela não mudam automaticamente a versão da atualização.

## Definir a volta pelo painel

Execute uma vez o arquivo `supabase-manutencao.sql` no SQL Editor do Supabase. Depois, entre como admin, abra o controle de manutenção, escolha **Data e hora da volta (Brasília)** e clique em **salvar volta**. O botão **sem prazo** remove a data.

A contagem busca o prazo salvo no Supabase e consulta mudanças a cada 15 segundos. No horário escolhido, o site permite o acesso dos visitantes. A data inicial continua sendo **10/10/2026 às 18h**; `config.js` serve de compatibilidade até executar o SQL.

Se as duas versões usarem o mesmo Supabase, a manutenção e o prazo são os mesmos nas duas. O SQL não habilita fanarts, contas de fãs ou outras funções da atualização.
