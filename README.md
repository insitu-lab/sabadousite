# Pacote pronto para publicar

Envie TODO o conteÃºdo desta pasta para a raiz do repositÃ³rio no GitHub.
Mantenha as pastas js, css, assets, audio e img como estÃ£o.
index.html, config.js e manutencao.html ficam na raiz.

NÃ£o envie a prÃ³pria pasta deste pacote como uma subpasta do repositÃ³rio.
NÃ£o substitua index.html pelo arquivo da pasta de ediÃ§Ã£o site-oficial.
Os caminhos do index.html deste pacote jÃ¡ estÃ£o ajustados para o site publicado.

Se o GitHub recusar o lote assets, cancele o envio antigo e envie assets/3d,
assets/videos e assets/sfx em commits separados, mantendo esses caminhos.
Envie tambÃ©m o HTML, js, vendor e release.json novos: o modelo agora usa GLB.
O ZIP e os FBX originais nÃ£o devem ser enviados para o repositÃ³rio do site.

Os SQLs e a Edge Function ficam em supabase/ na raiz do projeto de ediÃ§Ã£o e sÃ£o aplicados separadamente.

Inclua release.json no upload: ele identifica esta publicaÃ§Ã£o e permite atualizar abas abertas.
Na primeira instalaÃ§Ã£o do monitor, ative a manutenÃ§Ã£o antes de publicar; apÃ³s o deploy completo,
execute supabase-sabadometro-ritmo.sql e desative a manutenÃ§Ã£o. Assim as pÃ¡ginas antigas que
jÃ¡ acompanham a manutenÃ§Ã£o passam pela pÃ¡gina de espera e voltam para a versÃ£o nova.