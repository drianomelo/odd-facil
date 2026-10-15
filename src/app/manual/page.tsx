import Link from 'next/link';
import { PlayerAnalysisCard } from '@/components/PlayerAnalysisCard';
import { SuggestedTickets } from '@/components/SuggestedTickets';
import { buildSuggestedTickets } from '@/lib/analysis/bet-builder';
import { PlayerPropCandidate } from '@/lib/analysis/player-props';

export const metadata = {
  title: 'Manual | Odd Fácil',
  description: 'Como usar o Odd Fácil e interpretar análises, bilhetes e métricas da NBA.',
};

const sections = [
  { href: '#primeiros-passos', label: 'Começar' },
  { href: '#ler-palpite', label: 'Ler um palpite' },
  { href: '#bilhetes', label: 'Bilhetes sugeridos' },
  { href: '#termos', label: 'Glossário' },
  { href: '#paginas', label: 'Páginas do sistema' },
  { href: '#resultados', label: 'Resultados e limites' },
];

const EXAMPLE_PICK: PlayerPropCandidate = {
  id: 'manual-example-player-points',
  gameId: 'manual-example-game',
  game: 'Time A @ Time B',
  commenceTime: '2026-10-21T00:00:00.000Z',
  player: 'Atleta de exemplo',
  market: 'player_points',
  line: 20.5,
  projection: 23.7,
  probabilityOver: 0.61,
  probabilityUnder: 0.39,
  marketProbabilityOver: 0.5,
  marketProbabilityUnder: 0.5,
  bestOver: { side: 'Over', price: -110, bookmaker: 'Casa de exemplo', updatedAt: '2026-10-20T12:00:00.000Z' },
  bestUnder: { side: 'Under', price: -110, bookmaker: 'Casa de exemplo', updatedAt: '2026-10-20T12:00:00.000Z' },
  quotes: [
    { side: 'Over', price: -110, bookmaker: 'Casa de exemplo', bookmakerKey: 'example', updatedAt: '2026-10-20T12:00:00.000Z' },
    { side: 'Under', price: -110, bookmaker: 'Casa de exemplo', bookmakerKey: 'example', updatedAt: '2026-10-20T12:00:00.000Z' },
  ],
  edge: 0.11,
  expectedValue: 0.1645,
  edgeUnder: -0.11,
  expectedValueUnder: -0.2555,
  recommendationSide: 'Over',
  sampleSize: 20,
  shortlistEligible: true,
  last5Average: 25.2,
  last10Average: 23.4,
  last20Average: 22.1,
  averageMinutes: 34,
  minutesTrend: 1.04,
  opponentAverage: 21.8,
  opponent: 'Time A',
  teamVerified: true,
  confidence: 'moderada',
  reasons: ['Projeção ilustrativa acima da linha.', 'Médias recentes fictícias para demonstrar a leitura.'],
  limitations: ['Exemplo didático; não corresponde a uma previsão real do dia.'],
};

const EXAMPLE_TICKETS = buildSuggestedTickets([EXAMPLE_PICK]);

export default function ManualPage() {
  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-court-border bg-court-card/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-court-accent" aria-hidden="true">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
              </svg>
            </div>
            <span className="text-lg font-bold text-court-text">Odd Fácil</span>
            <span className="badge badge-info hidden sm:inline-flex">NBA</span>
          </div>
          <nav aria-label="Navegação principal" className="flex items-center gap-4 overflow-x-auto whitespace-nowrap">
            <Link href="/" className="text-sm text-court-textMuted transition-colors hover:text-court-text">NBA</Link>
            <Link href="/history" className="text-sm text-court-textMuted transition-colors hover:text-court-text">Histórico</Link>
            <Link href="/performance" className="text-sm text-court-textMuted transition-colors hover:text-court-text">Desempenho</Link>
            <Link href="/manual" aria-current="page" className="text-sm font-medium text-court-text">Manual</Link>
          </nav>
        </div>
      </header>

      <article className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="max-w-3xl border-b border-court-border pb-6">
          <h1 className="text-3xl font-bold text-court-text sm:text-4xl">Manual do Odd Fácil</h1>
          <p className="mt-3 text-base leading-7 text-court-textMuted">
            Um guia para consultar a análise NBA, entender cada número dos palpites e acompanhar os resultados sem confundir estimativa com desempenho comprovado.
          </p>
        </header>

        <nav aria-label="Nesta página" className="border-b border-court-border py-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-court-textMuted">Nesta página</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {sections.map(section => <li key={section.href}><a className="text-court-accent underline-offset-4 hover:underline" href={section.href}>{section.label}</a></li>)}
          </ul>
        </nav>

        <div className="max-w-3xl divide-y divide-court-border">
          <section id="primeiros-passos" className="scroll-mt-24 py-7">
            <h2 className="text-xl font-semibold text-court-text">Começar por aqui</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-court-textMuted">
              <li>Na página <Link className="text-court-accent underline-offset-4 hover:underline" href="/">NBA</Link>, confira o status das fontes e a data dos jogos.</li>
              <li>Leia os palpites de jogadores junto com projeção, linha, médias recentes, chance estimada e alertas.</li>
              <li>Use “Bilhetes sugeridos” como uma seleção experimental de opções que passaram por filtros. Se nenhum palpite cumprir os critérios, a tela pode não sugerir bilhete.</li>
              <li>Depois dos jogos, confira os registros em <Link className="text-court-accent underline-offset-4 hover:underline" href="/history">Histórico</Link> e os indicadores agregados em <Link className="text-court-accent underline-offset-4 hover:underline" href="/performance">Desempenho</Link>.</li>
            </ol>
            <p className="mt-4 rounded-lg border border-court-warning/30 bg-court-warning/10 p-4 text-sm leading-6 text-court-text">
              A versão atual ainda está em avaliação. Um palpite exibido não é garantia de acerto ou lucro. Confira escalações, lesões, minutos esperados e a cotação atual antes de tomar qualquer decisão.
            </p>
          </section>

          <section id="ler-palpite" className="scroll-mt-24 py-7">
            <h2 className="text-xl font-semibold text-court-text">Como ler um palpite</h2>
            <p className="mt-2 text-sm leading-6 text-court-textMuted">Cada análise trata de um jogador, uma estatística e uma linha específica para uma partida.</p>
            <dl className="mt-5 divide-y divide-court-border border-y border-court-border">
              <Definition term="Jogador, jogo e mercado">Identificam quem está sendo analisado, contra quem joga e qual estatística será medida.</Definition>
              <Definition term="Mais de / Menos de (Over / Under)">O lado sugerido em relação à linha. Exemplo: Mais de 20,5 pontos significa 21 pontos ou mais; Menos de 20,5 significa 20 ou menos.</Definition>
              <Definition term="Projeção">Estimativa pontual do modelo para a estatística do jogador. Não é a linha da casa nem uma promessa do resultado.</Definition>
              <Definition term="Chance do modelo">Probabilidade experimental atribuída ao lado mostrado. Ainda não foi calibrada com uma série de resultados reais.</Definition>
              <Definition term="Linha e cotação">A linha é o limite do mercado. A cotação é o preço coletado para Mais ou Menos, junto ao nome da casa quando disponível. A linha salva no Histórico é a observada quando o palpite foi registrado.</Definition>
              <Definition term="Médias L5, L10 e L20">Média da estatística nos últimos 5, 10 e até 20 jogos usados. A amostra pode ser menor se houver menos jogos válidos.</Definition>
              <Definition term="Amostra">Quantidade de jogos usados para a análise. Uma amostra maior ajuda a dar contexto, mas não elimina variação nem garante que a próxima partida será parecida.</Definition>
              <Definition term="Minutos e tendência">Minutos médios e comparação dos minutos recentes com a amostra. Mudanças de rotação, lesões e escalação podem alterar muito uma projeção.</Definition>
              <Definition term="Confronto / adversário">O time do jogador é conferido contra a partida agendada. Uma média contra o adversário só entra no ajuste quando há amostra direta suficiente.</Definition>
              <Definition term="Sinais a favor e pontos de atenção">Resumo da relação entre projeção, linha, forma recente, mercado e minutos. Leia os dois lados; um sinal favorável não anula os alertas.</Definition>
            </dl>
            <div className="mt-6 space-y-3">
              <p className="text-xs font-medium text-court-warning">Exemplo didático — todos os valores e nomes abaixo são fictícios.</p>
              <PlayerAnalysisCard pick={EXAMPLE_PICK} />
              <p className="text-xs leading-5 text-court-textMuted">A carta acima é o mesmo componente usado na página NBA. Compare a linha (20,5) com a projeção (23,7), depois confira se as médias, chance e sinais sustentam o lado; em seguida leia os pontos de atenção e limitações.</p>
            </div>
            <p className="mt-4 text-sm leading-6 text-court-textMuted">“Candidato para validação” indica que passou por critérios de qualidade dos dados, amostra e cotação. Não significa que seja uma aposta validada ou lucrativa.</p>
          </section>

          <section id="bilhetes" className="scroll-mt-24 py-7">
            <h2 className="text-xl font-semibold text-court-text">Bilhetes sugeridos</h2>
            <p className="mt-2 text-sm leading-6 text-court-textMuted">O sistema monta as sugestões apenas com palpites que passam pelos filtros atuais, têm uma cotação utilizável e apresentam EV experimental positivo.</p>
            <dl className="mt-5 divide-y divide-court-border border-y border-court-border">
              <Definition term="Simples">Uma seleção. A chance mostrada é a estimativa experimental do modelo para esse palpite.</Definition>
              <Definition term="Múltipla com 2 seleções">Duas seleções de jogadores em partidas diferentes. A sugestão usa uma mesma casa nas duas pernas e calcula a odd com os preços oferecidos por ela.</Definition>
              <Definition term="Exagerada · 6 palpites">Seis jogadores diferentes que passaram pelos filtros. Podem existir seleções da mesma partida, então pode haver correlação entre elas.</Definition>
              <Definition term="Montar meu bilhete">Escolha até 10 destaques do radar em vários mercados. O bilhete usa uma casa disponível para todas as seleções e acompanha as pernas no Histórico. Seleções da mesma partida podem ser combinadas, mas a odd conjunta fica a cargo da casa.</Definition>
              <Definition term="Odd combinada">Cálculo das odds das pernas escolhidas na mesma casa. As linhas e os preços podem mudar; confira a disponibilidade diretamente antes de usar.</Definition>
              <Definition term="Bilhete salvo / aposta pessoal">Cada salvamento registra uma aposta com valor apostado, odd e retorno potencial. Na aba “Apostas pessoais” do Histórico, você pode corrigir esses dados, registrar o resultado e o retorno recebido pela casa, incluindo bônus, ou excluir o bilhete.</Definition>
              <Definition term="Retorno potencial e retorno recebido">Retorno potencial é o pagamento total previsto, incluindo o valor apostado; pode ser ajustado para refletir bônus. Retorno recebido é o valor realmente creditado pela casa e deve ser informado depois da liquidação. O controle financeiro usa o retorno recebido quando preenchido.</Definition>
              <Definition term="Resultado da casa">Na aposta pessoal, escolha o resultado confirmado pela casa. “Usar apuração do sistema” mantém o resultado calculado a partir das previsões individuais.</Definition>
              <Definition term="Chance conjunta não estimada">O sistema não multiplica as probabilidades como se todas as pernas fossem independentes. Props do mesmo jogo ou jogador podem estar relacionadas; por isso, a chance da múltipla fica indisponível.</Definition>
            </dl>
            <div className="mt-6 space-y-3">
              <p className="text-xs font-medium text-court-warning">Exemplo didático — a seleção e os valores são fictícios.</p>
              <SuggestedTickets tickets={EXAMPLE_TICKETS} saveEnabled={false} />
              <p className="text-xs leading-5 text-court-textMuted">Este é o componente real de bilhetes usado na página NBA, preenchido com um exemplo inventado para mostrar onde conferir lado, cotação, casa, chance e tamanho da amostra.</p>
            </div>
            <p className="mt-4 text-sm leading-6 text-court-textMuted">“Exagerada” tem risco elevado porque todas as seleções precisam acertar para a múltipla vencer. O sistema não recomenda o valor a apostar; informe o valor real do seu bilhete ao salvar.</p>
          </section>

          <section id="termos" className="scroll-mt-24 py-7">
            <h2 className="text-xl font-semibold text-court-text">Glossário</h2>
            <dl className="mt-5 divide-y divide-court-border border-y border-court-border">
              <Definition term="Mercado de jogador (prop)">Aposta sobre uma estatística individual, em vez do vencedor da partida. O sistema cobre pontos, rebotes, assistências, cestas de três e PRA.</Definition>
              <Definition term="PRA">Soma de pontos, rebotes e assistências do jogador.</Definition>
              <Definition term="Odd americana (+ / −)">Formato da cotação recebido da fonte. Odds positivas indicam lucro potencial sobre 100 unidades; odds negativas indicam quanto precisa ser arriscado para obter 100 unidades de lucro. O retorno real depende do valor apostado e das regras da casa.</Definition>
              <Definition term="Odd decimal">Formato usado para calcular a odd combinada. Por exemplo, odd decimal 2,00 corresponde a retorno total potencial de 2 unidades por unidade apostada, incluindo a unidade inicial.</Definition>
              <Definition term="Probabilidade do mercado sem margem">Estimativa derivada das cotações de Mais e Menos da mesma casa, ajustada para remover a margem matemática daquela casa. É uma referência do mercado, não uma previsão independente.</Definition>
              <Definition term="EV e EV esperado">Valor esperado calculado como chance estimada × odd decimal − 1. No radar de jogadores, é experimental porque a chance do modelo ainda não foi validada. Nas oportunidades de jogo, vem do módulo de análise de odds. EV positivo é uma estimativa, não garantia de lucro.</Definition>
              <Definition term="Edge (vantagem estimada)">Diferença entre a chance do modelo e a probabilidade do mercado sem margem, em pontos percentuais. Edge positivo significa que a estimativa do modelo está acima da referência de mercado; não prova que o modelo esteja certo.</Definition>
              <Definition term="Push">Resultado empatado com uma linha inteira, quando as regras do mercado devolvem a aposta. Exemplo: linha de 20 pontos e resultado de exatamente 20.</Definition>
              <Definition term="Confiança baixa / moderada">Rótulo interno sobre quantidade de jogos e estabilidade recente dos minutos. Não é a probabilidade de acertar.</Definition>
              <Definition term="Acerto (%)">Na página Desempenho, proporção de acertos entre palpites decisivos: acertos divididos por acertos + erros. Pushes e anuladas não entram nesse cálculo.</Definition>
              <Definition term="Erro médio">Distância média, em unidades da estatística, entre a projeção salva e o valor real. Números menores indicam projeções mais próximas nessa amostra.</Definition>
              <Definition term="Brier Score">Erro entre a probabilidade prevista e o resultado binário de acerto ou erro. Vai de 0 para previsão perfeita a 1 para erro máximo; menor é melhor. É calculado só em palpites decididos, sem push ou anulada.</Definition>
              <Definition term="ROI e unidades">Retorno líquido retrospectivo dividido pelo total de apostas decididas com cotação salva. A unidade é uma medida padronizada por palpite, não dinheiro real nem sugestão de valor de aposta.</Definition>
              <Definition term="Pré-temporada / temporada regular">Fases separadas no Histórico. Os números da página Desempenho consideram a temporada regular; pré-temporada não entra nessa avaliação.</Definition>
              <Definition term="Odd coletada / odd justa">Na seção de oportunidades de jogos, odd coletada é o preço observado numa casa. Odd justa é o preço teórico equivalente à probabilidade estimada pelo modelo; não é necessariamente uma cotação disponível para apostar.</Definition>
              <Definition term="Completude dos dados">Percentual interno que resume quanto dos dados esperados está disponível para uma oportunidade de jogo. Leia junto dos fatores e alertas; completude alta não garante previsão correta.</Definition>
              <Definition term="Fatores e impacto">Explicações do módulo de oportunidades de jogos, classificadas como favoráveis, incerteza ou limitação. “Alto / médio / baixo” indica importância atribuída pelo sistema, não probabilidade.</Definition>
              <Definition term="Atual / desatualizado / indisponível">Rótulos de frescor das odds de jogos. Descrevem a idade dos dados em relação aos limites do sistema; confirme o preço diretamente na casa antes de usar.</Definition>
              <Definition term="Créditos API">Contador de uso exibido para a fonte de odds de jogos. Ele não representa saldo de aposta nem mede diretamente o uso da PropLine.</Definition>
              <Definition term="Status da fonte">“Não configurado” indica que falta uma variável de configuração. “Operacional” na tela atual significa que a chave foi detectada; não confirma por si só que a API acabou de responder ou que todos os dados estão completos.</Definition>
            </dl>
          </section>

          <section id="paginas" className="scroll-mt-24 py-7">
            <h2 className="text-xl font-semibold text-court-text">O que cada página mostra</h2>
            <div className="mt-5 space-y-6">
              <PageGuide title="NBA — análise do dia" href="/" linkLabel="Abrir NBA">
                <ul className="list-disc space-y-2 pl-5">
                  <li><strong className="text-court-text">Status das fontes:</strong> mostra se as chaves estão configuradas, o estado informado e, quando disponível, os créditos da The Odds API. Uma chave configurada não garante que todos os dados estejam atualizados.</li>
                  <li><strong className="text-court-text">Painel inicial:</strong> configurações, status das fontes e créditos API ficam à esquerda; os jogadores em destaque alternam no centro; à direita aparecem palpites no radar, jogos agendados, oportunidades qualificadas e horários de atualização.</li>
                  <li><strong className="text-court-text">Radar de props:</strong> apresenta até dois destaques por mercado, além da contagem de props analisadas e quantas passaram pelos filtros de validação. Expanda “Ver cálculos e limitações do modelo” para ler justificativas e alertas.</li>
                  <li><strong className="text-court-text">Bilhetes:</strong> veja as opções prontas ou marque até 10 destaques de diferentes mercados em “Montar meu bilhete”. Escolha uma casa disponível para todas as pernas e salve para acompanhar no Histórico.</li>
                  <li><strong className="text-court-text">Oportunidades do dia:</strong> mercados de partida baseados nas odds disponíveis. “Qualificada” aplica os limites atuais de EV e completude (padrão: 5% e 60%); é diferente do filtro de qualidade de props de jogadores.</li>
                  <li><strong className="text-court-text">Jogos nos próximos 7 dias:</strong> partidas agendadas, ao vivo ou finalizadas, com odds de vencedor, spread e total quando disponíveis. “Casa/Fora” indica o vencedor; “Mais/Menos” indica o total de pontos. A probabilidade apresentada vem do mercado sem margem e não de uma previsão estatística independente.</li>
                </ul>
              </PageGuide>

              <PageGuide title="Histórico — previsões e apostas" href="/history" linkLabel="Abrir Histórico">
                <p>As abas separam “Previsões do sistema”, usadas para medir o modelo, de “Apostas pessoais”, que representam bilhetes que você realmente salvou. A aba de previsões lista partida, jogador, mercado, lado, linha, odd, projeção, valor real quando disponível, probabilidade, amostra e status.</p>
                <p className="mt-2">Em Apostas pessoais, filtre por período e veja total apostado, retorno apurado e lucro/prejuízo. Edite o valor, odd decimal, retorno potencial, retorno efetivamente recebido (incluindo bônus) e o resultado confirmado pela casa. “Excluir bilhete” remove o registro e suas pernas do controle financeiro.</p>
                <p className="mt-2">Na aba de previsões, escolha resultado, mercado, fase e datas e pressione “Filtrar”; o botão de limpar remove os filtros. “Carregar mais previsões” pagina a lista.</p>
                <p className="mt-2">Status: <strong className="text-court-text">Pendente</strong> aguarda apuração; <strong className="text-court-text">Acertou</strong> e <strong className="text-court-text">Errou</strong> comparam o valor real à seleção; <strong className="text-court-text">Push</strong> indica empate na linha; <strong className="text-court-text">Anulada</strong> indica que não foi possível liquidar a previsão.</p>
              </PageGuide>

              <PageGuide title="Desempenho — previsões e apostas" href="/performance" linkLabel="Abrir Desempenho">
                <p>A aba “Resultados gerais” resume previsões individuais da temporada regular, com acertos, erros, pushes, anuladas, ROI observado e resultados por mercado. Também lista os últimos palpites apurados. A pré-temporada pode ser consultada à parte no Histórico.</p>
                <p className="mt-2">A aba “Meus bilhetes salvos” mostra somente os bilhetes registrados como apostas pessoais: status combinado, valor apostado, retorno e lucro/prejuízo. Para corrigir odds, retornos ou o resultado da casa, abra a aposta no Histórico.</p>
                <p className="mt-2">Acerto é calculado sobre resultados decisivos (acertos e erros). Erro médio compara a projeção com a estatística final; menor tende a ser melhor. Brier compara a probabilidade registrada com o resultado de acerto/erro; quanto menor, melhor. ROI e unidades são retrospectivos e consideram apenas palpites apurados com cotação salva.</p>
                <p className="mt-2">Se ainda não há resultados, os campos mostram “—” ou “aguardando”. Isso significa que falta observação, não que o modelo teve desempenho zero.</p>
              </PageGuide>

              <PageGuide title="Manual — este guia" href="/manual" linkLabel="Voltar ao topo">
                <p>Use o índice no início para ir direto a um assunto. O Manual explica a interface atual e seus termos; ele não substitui as regras específicas de uma casa de apostas.</p>
              </PageGuide>
            </div>
          </section>

          <section id="resultados" className="scroll-mt-24 py-7">
            <h2 className="text-xl font-semibold text-court-text">Resultados, atualização e limites</h2>
            <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-6 text-court-textMuted">
              <li>Previsões são salvas com a linha e a cotação disponíveis no momento do registro. Odds mudam; consulte a casa para o preço atual.</li>
              <li>A apuração só considera previsões de partidas iniciadas há pelo menos 4 horas e busca estatísticas finais do jogador. No desenvolvimento local, com o servidor ligado e as variáveis necessárias configuradas, rode <code className="rounded bg-court-border px-1.5 py-0.5 text-court-text">npm run cron:grade-player-props</code> para solicitar a rotina. Se o placar ainda não estiver final ou o log não estiver disponível, o palpite continua pendente para uma tentativa posterior.</li>
              <li>Os indicadores refletem apenas as previsões e a versão de modelo identificadas na página. Não são backtest retrospectivo nem garantia de resultados futuros.</li>
              <li>Dados de lesões, escalações e minutos podem mudar. A análise experimental pode não incorporar notícias que saíram depois da coleta.</li>
              <li>O projeto prioriza serviços gratuitos. As fontes podem ter limites de uso ou ficar indisponíveis; o painel informa quando uma fonte não está configurada.</li>
              <li>Não compartilhe chaves de API. Configurações locais ficam no arquivo <code className="rounded bg-court-border px-1.5 py-0.5 text-court-text">.env.local</code>.</li>
            </ul>
          </section>
        </div>
      </article>
    </main>
  );
}

function Definition({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[minmax(10rem,0.85fr)_minmax(0,2fr)] sm:gap-5">
      <dt className="text-sm font-medium text-court-text">{term}</dt>
      <dd className="text-sm leading-6 text-court-textMuted">{children}</dd>
    </div>
  );
}

function PageGuide({ title, href, linkLabel, children }: { title: string; href: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-court-border pt-4 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-court-text">{title}</h3>
        <Link href={href} className="text-sm text-court-accent underline-offset-4 hover:underline">{linkLabel}</Link>
      </div>
      <div className="mt-3 space-y-2 text-sm leading-6 text-court-textMuted">{children}</div>
    </section>
  );
}
