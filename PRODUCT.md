# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Uma pessoa que acompanha NBA e quer analisar mercados de jogadores para encontrar opções de apostas com base em estatísticas.

## Product Purpose

O Odd Fácil reúne estatísticas recentes, linhas e cotações para produzir uma análise aprofundada de props da NBA, registrar previsões e comparar as estimativas com o que ocorreu nos jogos.

## Positioning

O valor principal é a análise das previsões e dos dados dos jogadores, com acompanhamento histórico, em vez de apenas listar odds disponíveis.

## Operating Context

O usuário consulta as recomendações antes dos jogos, acompanha os resultados depois das partidas e usa o histórico para avaliar a qualidade do modelo. A interface e as explicações são em português do Brasil.

## Capabilities and Constraints

- O escopo atual é NBA, com prioridade para estatísticas individuais de jogadores e possibilidade de combinar seleções em bilhetes.
- O usuário não quer pagar por fontes de dados; priorizar serviços e cotas gratuitas.
- E-sports foram removidos do escopo.
- Previsões devem guardar a linha e a cotação observadas para que possam ser comparadas com o resultado do jogo.
- A pré-temporada precisa ficar identificada separadamente da temporada regular.
- O histórico ainda não tem resultados reais apurados para a versão atual do modelo; não apresentar métricas como validação antes de obtê-los.

## Evidence on Hand

O projeto tem um painel NBA, análise experimental de props de jogadores e 178 previsões da versão `player-props-v0.5.0` registradas para avaliação. Ainda não há resultados reais apurados para essa versão.

## Product Principles

- Priorizar explicações e estatísticas úteis para a decisão do usuário.
- Distinguir projeções do modelo de resultados observados.
- Mostrar incerteza e limitações enquanto o modelo ainda não tem histórico suficiente.
- Preservar o uso de fontes gratuitas.
- Manter a pré-temporada separada na avaliação da temporada regular.
