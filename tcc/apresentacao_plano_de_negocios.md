# Apresentação do Plano de Negócios - BrioJS (IFPR Colombo)

Desenvolvemos um **slide deck interativo moderno e elegante**, totalmente web (HTML5/CSS3/Vanilla JS), localizado no diretório [apresentacao](file:///home/gustavo/Dev/brio-js/tcc/apresentacao/index.html). O design adota um tema escuro cyberpunk premium com glassmorphism, tipografia Inter/Outfit e realce neon, incorporando o mascote **Capivara Cyberpunk** criado sob medida e diagramas de fluxo de produto altamente profissionais.

Este guia serve como roteiro e colateral de apoio para os acadêmicos **Gustavo Luiz Gregorio** e **Lucas Bigliardi Vicente** para sua apresentação de 10 minutos na matéria de Plano de Negócios.

---

## 🎨 O Mascote Oficial: Brio Capivara
Como parte da identidade visual conectada às raízes paranaenses do IFPR, geramos o mascote oficial em formato neon-cyberpunk. O arquivo está integrado aos slides na capa:
![BrioJS Capivara Mascot](file:///home/gustavo/Dev/brio-js/tcc/apresentacao/assets/mascot.png)

---

## ⏱️ Roteiro da Apresentação (10 Minutos)

Abaixo está a minutagem sugerida e os pontos-chave de fala para cada slide:

### Slide 1: Capa (0:00 - 1:30)
*   **Visual**: Logo da Capivara BrioJS brilhando, badges de identificação acadêmica do IFPR Colombo.
*   **Foco da fala**:
    *   Cumprimentar a banca e professor(a).
    *   Apresentar os autores (Gustavo e Lucas) e o tema: BrioJS - uma game engine didática 2D.
    *   Definir brevemente o significado de "Brio" (paixão, capricho, orgulho no que se faz) como a faísca pedagógica para introduzir lógica de programação a novos estudantes.

### Slide 2: O Problema: O Vácuo Educacional (1:30 - 3:00)
*   **Visual**: Diagrama de fluxo mostrando a trilha de aprendizado de software comercial (Scratch ➔ BrioJS ➔ Unity). Destaque para a persona "Alexandre" e as dores da transição.
*   **Foco da fala**:
    *   *A Dor*: O estudante que termina de usar o Scratch não sabe para onde ir. Se tentar Unity ou Unreal diretamente, desiste por causa da curva de aprendizado agressiva e da necessidade de computadores de alto desempenho.
    *   *O Vácuo*: Existe um gap entre a programação por blocos (abstração excessiva que esconde o código) e as ferramentas profissionais (excesso de complexidade e boilerplate).

### Slide 3: A Solução: BrioJS (3:00 - 4:30)
*   **Visual**: Lista de diferenciais (Zero Instalação com ícone global de internet, JS/TypeScript nativo) lado a lado com um mockup de IDE rodando um jogo de nave em tempo real.
*   **Foco da fala**:
    *   Como o BrioJS resolve isso: rodando 100% no navegador (sem instalar nada, ideal para escolas públicas com computadores fracos).
    *   Uso de JavaScript/TypeScript: linguagens nativas da web, portáveis e com altíssima demanda profissional real de mercado.
    *   Abstração cirúrgica de conceitos de engine (Assets, Loop, Collision) sem esconder a sintaxe de código real do aluno.

### Slide 4: Arquitetura e Fluxo do Jogo (4:30 - 6:00)
*   **Visual**: Fluxograma detalhado do ciclo de vida técnico (Constructor ➔ Preload ➔ Load ➔ Update Loop).
*   **Foco da fala**:
    *   Explicar que o BrioJS ensina boas práticas de engenharia de software na prática, espelhando a classe `BrioGame.ts`.
    *   *Fluxo Técnico*: A inicialização e Canvas binding (`Constructor`), carregamento assíncrono de recursos (`preload`), registro e snapshot de entidades (`load`), e o loop dinâmico por `requestAnimationFrame` (`update`).
    *   Otimização: O projeto estimula os alunos a utilizarem padrões como *Object Pooling* (reaproveitamento de objetos na memória) e renderização ordenada por camadas para evitar framedrops de Garbage Collection.

### Slide 5: Análise SWOT Educacional (6:00 - 7:30)
*   **Visual**: Matriz SWOT disposta horizontalmente em 4 colunas verticais elegantes com cores neon diferenciadoras.
*   **Foco da fala**:
    *   *Forças*: Leveza extrema, portabilidade Web e filosofia open source.
    *   *Fraquezas*: Início do projeto e escopo de recursos menor em comparação a players gigantes.
    *   *Oportunidades*: Adoção na rede de Ensino Médio Técnico (IFs e escolas públicas) que buscam incluir computação no currículo sem gastos com hardware de ponta.
    *   *Ameaças*: Concorrência de soluções no-code pré-existentes e ritmo acelerado de frameworks JS.

### Slide 6: Sustentabilidade e Futuro Comercial (7:30 - 9:00)
*   **Visual**: Diagrama de fluxo comercial (Core Platform open-source ➔ Community Growth ➔ SaaS Cloud Editor, Enterprise AI Assistant, Certifications).
*   **Foco da fala**:
    *   **Filosofia Central**: O projeto é livre e gratuito (Open Source). Não busca lucro imediato ou a médio prazo. O ganho inicial é puramente acadêmico, científico e social.
    *   **Monetização Indireta e Ecossistema**: Caso a engine ganhe penetração de mercado e comunidade, abre-se a possibilidade de faturamento indireto por meio de ferramentas agregadas:
        1.  *SaaS Cloud Editor*: Uma plataforma visual em nuvem para gerenciamento de turmas, tarefas e exportação visual rápida para escolas.
        2.  *Enterprise AI Assistant*: Ferramentas inteligentes para autoria de código e auxílio pedagógico integrado.
        3.  *Treinamento e Certificações*: Cursos de capacitação didática para professores.

### Slide 7: Conclusão & Próximos Passos (9:00 - 10:00)
*   **Visual**: Agradecimentos e novos horizontes de produto.
*   **Foco da fala**:
    *   A fundamentação científica baseia-se em *Design Science Research* (DSR), onde cria-se um artefato prático que soluciona um vácuo de mercado real.
    *   **Horizontes Futuros**: 
        *   Validação científica através de testes práticos de usabilidade com alunos reais.
        *   Expansão técnica para renderização 3D utilizando as APIs nativas de alta performance **WebGL e WebGPU**.
        *   Expansão de ferramentas inteligentes com o **brio-agent**, que futuramente será aprimorado como um assistente de manifesto inteligente com suporte RAG e Skills em tempo real.
    *   Agradecer e abrir espaço para perguntas da banca.

---

## 🛠️ Como Executar os Slides
Para visualizar a apresentação rodando de forma interativa, basta abrir o arquivo [index.html](file:///home/gustavo/Dev/brio-js/tcc/apresentacao/index.html) diretamente no seu navegador.
*   **Controles normais**: Setas esquerda/direita ou Barra de Espaço para avançar.
*   **Modo Tela Cheia**: Pressione <kbd>Shift</kbd> + <kbd>F</kbd> para alternar o modo tela cheia inteligente, focando apenas no slide deck.
