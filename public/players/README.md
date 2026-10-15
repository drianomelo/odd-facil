# Imagens de jogadores para a home

Coloque aqui imagens licenciadas de jogadores em corpo inteiro, de preferência em PNG com fundo transparente. Use arquivos verticais para que o jogador caiba no espaço central da tela.

Depois, adicione os caminhos dos arquivos ao array `fullBodyImages` em `src/components/PlayerSpotlight.tsx`, por exemplo:

```ts
const fullBodyImages = ['/players/jogador-1.png', '/players/jogador-2.png'];
```

Com mais de uma imagem, a home alterna entre elas automaticamente. O espaço não exibe nome, estatísticas nem controles.
