# BrioJS - Documentação do TCC e Análise Crítica

Este diretório (`tcc/`) é o playground acadêmico oficial do BrioJS. Ele concentra o Plano de Trabalho, o Plano de Negócios e as demais documentações vinculadas ao Trabalho de Conclusão de Curso (TADS/IFPR) dos acadêmicos Gustavo Luiz Gregorio e Lucas Bigliardi Vicente, sob orientação de Carine Azevedo Dantas.

Abaixo, apresento uma análise crítica fundindo o embasamento teórico, as motivações do autor e o real estado arquitetural da engine.

---

## 1. Origem e Filosofia do Projeto

A concepção da BrioJS nasce de uma experiência empírica de seu criador (Gustavo), que encontrou na curva de aprendizado da Unity e da linguagem C# uma barreira frustrante em seus primeiros passos na programação. Esta frustração inicial, seguida de uma migração bem-sucedida para o Desenvolvimento Web Fullstack, serviu como gatilho para a ideia central: **criar uma ponte acessível.**

- **O Nome**: "Brio" traduz paixão, capricho, amor-próprio e força de vontade. É o sentimento que se espera despertar nos estudantes que utilizarão a ferramenta.
- **A Identidade Visual**: Em desenvolvimento, com forte intenção de incorporar uma **Capivara**, animal símbolo do Paraná e da região Sul, conectando a engine às suas raízes geográficas (IFPR).

## 2. A Lacuna Lógica: Scratch ➔ BrioJS ➔ Unity

A análise do **Anexo C** e do **Plano de Negócios** escancara um problema crônico na educação de software:
1. **Ferramentas de Blocos (Scratch/GDevelop)**: São excelentes para instigar o pensamento lógico, mas limitadas. Não expõem o aluno a código textual, tipagem ou estruturação real de projetos.
2. **Engines Profissionais (Unity/Godot/Unreal)**: São excessivamente complexas. A sobrecarga de conceitos (componentes, padrões intrincados da ferramenta, compiladores pesados) afasta o aluno do aprendizado focado na lógica pura.

O BrioJS posiciona-se exatamente no **"Vácuo Educacional"** entre esses dois extremos. Seu objetivo não é competir com engines comerciais massivas, mas fornecer uma **Plataforma Intermediária**.

### Por que JS/TypeScript?
Ao contrário de ferramentas nichadas (como Game Maker ou RPGMaker, onde o conhecimento adquirido fica preso à plataforma), JavaScript e TypeScript são as bases da internet. Ensinar lógica de jogos utilizando TS/JS prepara o aluno para cenários práticos além da produção de games, sendo linguagens cada vez mais adotadas nos currículos de Ensino Médio Técnico e do Novo Ensino Médio.

### O Diferencial contra Phaser ou Kaboom.js
Embora o ecossistema JS já possua bibliotecas de jogos, o BrioJS não se propõe apenas a "fazer jogos de forma fácil", mas sim a **forçar e reforçar bons padrões de engenharia** (Orientação a Objetos, encapsulamento, Object Pooling). O BrioJS é, antes de tudo, uma ferramenta didática de boas práticas.

---

## 3. Análise da Arquitetura e Engenharia Atual

A atual topologia de arquivos na pasta `src/` valida diretamente a proposta do TCC:

- **Acessibilidade e Foco em Web**: A engine utiliza a **Canvas 2D API** do HTML5. Sem WebGL intrincado, sem dependências colossais. Rodar o projeto de demonstração (`demo/`) requer apenas um arquivo `index.html` e os módulos JavaScript. Nenhuma instalação é necessária, quebrando a barreira da configuração de ambiente mencionada nas "Dores da Persona".
- **Código Abstraído, porém Real**: A classe `BrioGame` orquestra o Game Loop (Promises para `preload` -> `load` -> `update`). Isso ensina ao aluno conceitos cruciais como ciclo de vida da aplicação e processamento síncrono/assíncrono, de maneira contida.
- **Práticas de Otimização**: Vimos no script de demo a utilização de uma pool de projéteis (`projectile_pool`). A engine encoraja a manipulação criteriosa da memória (evitando excessivo Garbage Collection), o que é vital tanto em Game Dev quanto em Web Dev avançado.

---

## 4. Análise de Viabilidade e Negócios

O **Plano de Negócios** (voltado para impacto social e acadêmico, sem fins lucrativos imediatos) reforça a essência Open Source.
- **Custos**: Baixíssimos. Utiliza Git, navegadores padrão e TypeScript.
- **Forças (SWOT)**: Menor complexidade e execução in-browser.
- **Oportunidades**: Parcerias institucionais. Ao focar em "Alexandre" (estudantes de ensino médio e técnico), o BrioJS tem potencial de adoção em laboratórios de informática escolares onde a instalação de softwares como Unity é proibida por falta de hardware adequado.

---

## 5. Metodologia e Próximos Passos (Design Science Research)

O TCC segue a abordagem **Design Science Research**, que foca na criação de um "Artefato" (A Engine) e em sua avaliação. O cronograma prevê testes comparativos com usuários.

### Como o Guardião (Brio Agent) pode atuar daqui em diante:
1. **Polimento dos "Not-Implemented"**: Módulos mapeados no código (`BrioCamera`, `BrioGamepad`, `BrioMap`, `BrioStorage`) precisam ser finalizados antes dos testes práticos com usuários para garantir que a engine cubra necessidades básicas 2D (câmera que segue o player e carregamento de tiled maps).
2. **Construção de Demos Didáticas**: Auxiliarei a criar jogos de exemplo que sirvam como base de testes comparativos para a etapa 7 do cronograma do Anexo C.
3. **ACO (Agent Context Optimization)**: Como destacado no Plano de Negócios, a engine é pensada para ser amigável à Inteligência Artificial. Garantirei que o código-fonte permaneça modular, com TSDoc impecável, facilitando que outros LLMs leiam e codifiquem para o BrioJS sem alucinações.

---
*Este arquivo documenta a interseção entre o plano de pesquisa acadêmico e a realidade arquitetural de engenharia do BrioJS. Mantido e analisado pelo Brio Agent.*
