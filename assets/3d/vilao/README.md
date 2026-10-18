# Modelo provisório enviado pelo usuário

Origem: pasta `VILAO FBX`, importada em 18/10/2026. Estes são os originais, sem alteração da aparência do personagem.

A prévia em `site-oficial/bacano-3d.html` usa `web/bacano-animado.glb`, com aproximadamente 5,7 MiB. Ele reúne as quatro animações dos FBX originais, com uma única malha e texturas compartilhadas. A geometria usa Draco; a aparência das imagens não foi editada. O modelo é provisório, conforme indicado pelo usuário.

A subpasta Meshy, suas imagens e os quatro FBX permanecem como referências de edição. O preparador de publicação inclui somente o GLB usado na prévia. O processo de conversão e combinação das animações fica em `ferramentas/3d/`. Não foi incluída conversa com IA nesta etapa.

Seis gestos adicionais são gerados por código em `comum/js/sabadou-character-gestures.js`: falar, apontar, acenar, pensar, confirmar e comemorar. Eles não aumentam o GLB. O modelo não contém mandíbula articulada ou formas de boca, portanto o gesto de falar usa apenas corpo, braços e cabeça. Veja a interface futura de controle pela conversa em `ferramentas/3d/GESTOS-E-IA.md`.
