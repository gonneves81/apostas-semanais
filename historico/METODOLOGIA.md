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
