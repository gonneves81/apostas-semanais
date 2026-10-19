# Protocolo de avaliação semanal — Apostas Semanais

## Calendário e proteção contra retrospetiva

- Todas as segundas-feiras às 01h00, Europe/Lisbon, verificar a semana civil anterior (segunda a domingo), antes de produzir previsões para a nova semana.
- Arquivar cada previsão com equipas, competição, data/hora do início, probabilidades, fonte, versão do modelo e carimbo de publicação. Nunca substituir um registo após o encontro.
- Para efeitos de avaliação exclusivamente **pré-jogo**, não pontuar previsões arquivadas depois da hora real do início do encontro.
- Verificar os resultados em fontes oficiais e independentes. Aguardar resultados definitivos; adiado, interrompido, não disputado ou sem estatísticas é pendente e não falha nem acerto.
- Os mercados de cantos e partes só são avaliados se esses dados constarem de uma fonte verificável.

## Métricas

- Para um evento binário com previsão p e resultado y (0 ou 1), **Brier = (p - y)^2**.
- Para eventos binários, **Log Loss = -[y ln(p) + (1-y) ln(1-p)]**, usando limites numéricos seguros para p=0 e p=1, que devem ser registados.
- **Taxa de acerto**: número de escolhas antecipadamente assinaladas que se verificaram / número de escolhas avaliáveis. Mostrar também esse numerador e denominador.
- Avaliar separadamente vitória da casa, empate, vitória de fora, BTTS sim/não, +1,5, +2,5, BTTS E +2,5, BTTS OU +2,5, cantos e vitórias por parte; evitar dupla contagem no indicador principal de acertos.
- Na previsão 1X2 considerar o evento de cada resultado e, quando adequado, Brier multiclasse. A soma dos três resultados tem de ser aproximadamente 1.
- Calibração: comparar intervalos de probabilidades previstos (ex.: 50%-59%, 60%-69%, etc.) com as frequências de ocorrência observadas. Não confundir uma amostra curta com certeza.
- ROI apenas se existir odd pré-jogo verificada e arquivada. Não inferir retorno a partir das odds justas do modelo.

## Melhorias e versão do modelo

- Não ajustar o modelo aos resultados da própria semana e avaliar a versão melhorada nessa mesma amostra.
- Usar separação temporal treino/validação (walk-forward), reter previsão-base e novo modelo em paralelo, publicar o tamanho das amostras.
- Só promover pesos novos, regularização ou calibração se o Brier/Log Loss melhorar fora da amostra de forma robusta; documentar versão, período de treino, teste e efeito.
- Guardar resultados verificados em `historico/AAAA-MM-DD-resultados.json`, sumarizações em `historico/desempenho.json` e versões em `historico/modelo.json`.
- Os jogos UEFA são avaliados do mesmo modo, mas a forma recente deve considerar competições domésticas e europeias sem misturar contextos às cegas.

## Arquivo inicial

- `historico/2026-10-19-previsoes.json`: 85 jogos iniciais, dos quais 76 têm probabilidades; 9 da segunda liga alemã tinham apenas calendário.
- `historico/2026-10-19-calendario-uefa.json`: 54 jogos das três competições europeias com calendário UEFA verificado; **sem previsões matemáticas** nesta edição.
- Não reportar acertos para jogos sem previsão prévia arquivada.

Todos os valores devem ser verificáveis e o site deve declarar explicitamente as limitações dos dados.


## Avaliador reproduzível (implementado em 19-10-2026)

O programa `scripts/avaliar_previsoes.py` recebe um arquivo pré-jogo imutável e um ficheiro independente de resultados finais verificados. Exemplo de execução depois de existirem resultados:

```bash
python3 scripts/avaliar_previsoes.py \
  --previsoes historico/2026-10-19-previsoes.json \
  --resultados historico/2026-10-19-resultados.json \
  --historico-dir historico
```

O formato de resultados exigido é:

```json
{
  "week_start": "AAAA-MM-DD",
  "source": "Fontes dos resultados",
  "games": [
    {
      "id": 123,
      "date": "AAAA-MM-DD",
      "home": "Equipa casa",
      "away": "Equipa fora",
      "home_goals": 0,
      "away_goals": 0,
      "half_home": 0,
      "half_away": 0,
      "corners_total": 0,
      "status": "FT",
      "verified": true,
      "source": "https://fonte-oficial.example/jogo"
    }
  ]
}
```

**Os números acima são apenas um exemplo de esquema; não são resultados de qualquer encontro.** Nunca copiar o exemplo como resultados verdadeiros. `half_home`, `half_away` e `corners_total` são opcionais e devem ser omitidos quando não verificados. A correspondência exige o mesmo ID, data e nomes de ambas as equipas, resultado final, fonte HTTPS e `verified=true`. A publicação de previsões tem de ser anterior ao pontapé de saída, em Europe/Lisbon. Ficheiros de resultados inexistentes ou incompletos não devem ser inventados.

O programa gera `historico/AAAA-MM-DD-avaliacao.json` (linhas auditáveis por mercado, resultado binário, Brier, log loss, Top 20, problemas e contagens) e recalcula o `historico/desempenho.json` acumulado. As taxas de classificação binária por mercado consideram como evento previsto `p>=0,5`; **não são taxas de retorno de apostas**. O indicador `picks_correct / picks_evaluated` usa apenas escolhas Top 20 arquivadas antecipadamente. Não existe ROI do modelo sem odds reais pré-jogo comprovadas.

O programa foi acompanhado de testes com dados **sintéticos**, para confirmar exclusão de previsões posteriores ao início, resultados não verificados, jogos trocados e fórmulas. Testes sintéticos não medem a precisão desportiva. A primeira calibração real só deve ser divulgada após número suficiente de jogos avaliados e validação temporal fora da amostra.

## Índice de cobertura dos dados e Top 5

O rótulo `Dados N/100` da interface é uma heurística de cobertura: 25 pontos por amostra de resultados, 25 por recortes casa/fora, 10 por forma, 15 por probabilidades disponíveis, 10 por xG documentado, 10 por contexto verificável de lesões/suspensões e 5 por H2H com fonte. **Nunca interpretar o índice como probabilidade de acerto**.

O Top 5 diário ordena pela probabilidade estimada e apresenta em separado a cobertura estatística e a odd justa (1/p). A odd justa **não é uma cotação de casa** e o limite de 1,20 aplica-se à odd comercial que o utilizador introduz na construção ou no registo dos boletins reais. Os filtros de probabilidade e odd justa são independentes.

## Boletins reais pessoais

`apostas-reais.js` guarda localmente, apenas no navegador do utilizador, registos que este confirma terem sido realmente apostados, com stake e odds manuais. Resultados, cash out, reembolsos e liquidações são **introduzidos pelo utilizador e não verificados pelo site**. O saldo e ROI pessoal incluem só os boletins liquidados, sem misturar rascunhos nem métricas do modelo. Não existe sincronização entre dispositivos. O ficheiro JSON pode ser exportado para cópia de segurança; a app pública não recebe estes registos pessoais.
