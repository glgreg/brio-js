// Every user-facing string of the showcase, in English (default) and Portuguese.
// Keep both sides complete: `pt` is typed against `en`, so a missing key fails the type check.

const en = {
    // nav
    "nav.games": "Games",
    "nav.how": "How it works",
    "nav.playground": "Playground",
    "nav.credits": "Credits",
    "nav.menu": "Menu",
    "nav.github": "GitHub",
    "lang.label": "Language",

    // hero
    "hero.eyebrow": "Open-source game engine · TypeScript · v{version}",
    "hero.title": "Make games <em>with brio</em>.",
    "hero.lead":
        "BrioJS is a 2D and 3D engine for the web with zero dependencies. Friendly enough for your first line of code, and fast enough to keep thousands of things moving at 60 fps.",
    "hero.play": "Play the demos",
    "hero.playground": "Open the playground",
    "hero.copy": "Copy",
    "hero.copied": "Copied!",
    "hero.caption": "Rendered live by BrioJS: WebGL2, soft shadows and a water shader. Move the mouse to look around.",
    "hero.fps": "{fps} fps",
    "hero.loading": "warming up the hot spring…",
    "hero.fallback": "Your browser could not start WebGL2, so the live scene is resting.",

    // definition strip
    "brio.word": "brio",
    "brio.phonetic": "/ˈbriː.oʊ/ · noun",
    "brio.def": "Vigor and verve; the spark of someone who genuinely enjoys what they are making.",

    // bridge
    "bridge.eyebrow": "Why it exists",
    "bridge.title": "The gentle slope between blocks and big engines.",
    "bridge.body":
        "Block tools are a wonderful first step, and professional engines are a wonderful destination. The road between them is steep: installers, heavy editors, a new language, a powerful computer. BrioJS lives in the middle, with real JavaScript and TypeScript running in the browser you already have.",
    "bridge.blocks": "Block tools",
    "bridge.blocks.note": "Scratch, GDevelop: great for logic, but no real code.",
    "bridge.brio": "BrioJS",
    "bridge.brio.note": "Real code, a browser tab, nothing to install.",
    "bridge.pro": "Pro engines",
    "bridge.pro.note": "Unity, Unreal: powerful, heavy, a steep first climb.",

    // mascot
    "mascot.eyebrow": "Meet the mascot",
    "mascot.title": "Capibrio keeps everything calm.",
    "mascot.body":
        "Capybaras are the calmest neighbors along Paraná's rivers. Birds, ducks and even monkeys happily sit on one. That is the job description of this engine too: a steady base you can stack your own ideas on.",
    "mascot.note": "You will find Capibrio around the site, usually napping. Wake it with a game.",

    // code
    "code.eyebrow": "Your first game",
    "code.title": "Read it once and you already know the lifecycle.",
    "code.body":
        "Load assets in <code>preload()</code>, build the world in <code>load()</code>, change it every frame in <code>update()</code>. Objects are plain classes with documented properties, and the editor autocompletes all of them.",
    "code.try": "Run this in the playground",
    "code.result": "This exact code, running",
    "code.point.1": "One entry point: <code>BrioGame</code> with a 2d, 3d or hybrid preset.",
    "code.point.2": "Input as named actions, so keyboard, gamepad and touch share one line.",
    "code.point.3": "WebGL2 first, with a Canvas2D fallback that keeps the game running.",

    // games
    "games.eyebrow": "Made with BrioJS",
    "games.title": "Demo games",
    "games.body":
        "Four small games, four different looks: pixel art drawn on the GPU, a low-poly forest, glowing glass and a risograph print. Each one opens in the playground with its full source.",
    "games.play": "Play",
    "games.edit": "Open source in playground",
    "games.controls": "Controls",

    // features
    "features.eyebrow": "Under the hood",
    "features.title": "Friendly outside. Data-oriented inside.",
    "features.ecs.title": "Classes on top, typed arrays underneath",
    "features.ecs.body":
        "You write <code>player.transform.position.x += 5</code>. The engine stores it in a Structure-of-Arrays ECS with generational handles, so the game loop allocates nothing.",
    "features.render.title": "WebGL2 first, never a blank screen",
    "features.render.body":
        "A backend cascade picks WebGL2 and falls back to a Canvas2D rasterizer. Both load on demand, so a 2D game never downloads the 3D renderer.",
    "features.light.title": "Light that looks good by default",
    "features.light.body":
        "Point, spot and directional lights, metallic-roughness shading, soft shadows, fog, tone mapping, and GLSL hooks when you want your own look.",
    "features.save.title": "Save anything, instantly",
    "features.save.body":
        "Checkpoints capture every object, scene and random seed into a binary snapshot that stays readable across engine versions.",
    "features.zero.title": "Zero dependencies",
    "features.zero.body":
        "No runtime packages at all. ES modules from npm or a CDN, tree-shakeable, with TypeScript declarations included.",
    "features.docs.title": "Documented everywhere",
    "features.docs.body":
        "Every public class and method has TSDoc with examples, so your editor explains the engine while you type.",
    "stats.deps": "runtime dependencies",
    "stats.tests": "automated tests",
    "stats.size": "minified engine",
    "stats.dims": "dimensions, one API",

    // playground teaser
    "teaser.eyebrow": "The playground",
    "teaser.title": "A game studio in a browser tab.",
    "teaser.body":
        "Write code with autocomplete, drop in sprites, models and sounds, and press Run. Projects are saved in your own browser: no account, no install, no upload.",
    "teaser.cta": "Start creating",
    "teaser.point.1": "Monaco editor with the full BrioJS type definitions",
    "teaser.point.2": "Drag and drop images, audio, glTF and GLSL",
    "teaser.point.3": "Console, errors and live preview side by side",
    "teaser.point.4": "Export your project as a zip whenever you want",

    // academic
    "tcc.eyebrow": "Where it comes from",
    "tcc.title": "Born as an undergraduate thesis in Paraná.",
    "tcc.body":
        "BrioJS started as a final project (TCC) of the Systems Analysis and Development program at IFPR, Campus Colombo, studying how to teach game development with real code and modern engine architecture.",
    "tcc.authors": "Authors",
    "tcc.advisor": "Advisor",

    // footer
    "footer.tagline": "Made in Paraná, with brio.",
    "footer.license": "MIT licensed. Demo assets belong to their creators.",
    "footer.credits": "Asset credits",
    "footer.docs": "Documentation",
    "footer.npm": "npm package",

    // play page
    "play.back": "All games",
    "play.restart": "Restart",
    "play.fullscreen": "Full screen",
    "play.edit": "Edit in playground",
    "play.controls": "Controls",
    "play.about": "About this game",
    "play.credits": "Credits",
    "play.features": "Engine features used",
    "play.notfound": "This game wandered off. Pick another one?",
    "play.clickToStart": "Click to start",
    "play.loading": "Loading…",
    "notfound.title": "Capibrio could not find this page.",
    "notfound.body": "It is probably napping somewhere else. These paths still work:",

    // credits page
    "credits.title": "Credits",
    "credits.body":
        "The demo games use free assets made by generous artists. Thank you! Each entry links to the original page and its license.",
    "credits.game": "Game",
    "credits.asset": "Asset",
    "credits.author": "Author",
    "credits.license": "License",
    "credits.engine":
        "BrioJS, this website and the playground are original work under the MIT license. Capibrio was drawn for this site.",
    "credits.fonts": "Fonts (SIL Open Font License, via Google Fonts): Fraunces, Bricolage Grotesque and JetBrains Mono on the site; Pixelify Sans, Fredoka, Outfit, Archivo Black and Space Mono in the games. Editor: Monaco (MIT).",

    // IDE
    "ide.run": "Run",
    "ide.stop": "Stop",
    "ide.runHint": "Run (Ctrl+Enter)",
    "ide.projects": "Projects",
    "ide.explorer": "Files",
    "ide.newFile": "New file",
    "ide.newFolder": "New folder",
    "ide.upload": "Add assets",
    "ide.export": "Export .zip",
    "ide.import": "Import .zip",
    "ide.console": "Console",
    "ide.clear": "Clear",
    "ide.preview": "Game",
    "ide.reload": "Reload",
    "ide.popout": "Open in new tab",
    "ide.saved": "Saved in this browser",
    "ide.saving": "Saving…",
    "ide.dropHere": "Drop files to add them to the project",
    "ide.emptyPreview": "Capibrio is napping. Press Run to wake it with your game.",
    "ide.rename": "Rename",
    "ide.delete": "Delete",
    "ide.duplicate": "Duplicate",
    "ide.confirmDelete": "Delete {name}? This cannot be undone.",
    "ide.confirmDeleteProject": "Delete the project \"{name}\" and all its files from this browser?",
    "ide.promptFile": "File name (you can use folders, e.g. src/player.js)",
    "ide.promptFolder": "Folder name",
    "ide.promptRename": "New name",
    "ide.promptProject": "Project name",
    "ide.newProject": "New project",
    "ide.myProjects": "My projects",
    "ide.templates": "Start from",
    "ide.templateBlank2d": "Blank 2D",
    "ide.templateBlank2dDesc": "A sprite on a WebGL2 orthographic camera, with input.",
    "ide.templateBlank3d": "Blank 3D",
    "ide.templateBlank3dDesc": "A lit cube, shadows and an orbiting camera.",
    "ide.open": "Open",
    "ide.updated": "edited {when}",
    "ide.noProjects": "No projects yet. Pick a starting point below.",
    "ide.binary": "Binary file",
    "ide.preview.image": "Image preview",
    "ide.preview.audio": "Audio preview",
    "ide.preview.other": "This file is used by your game but cannot be edited here.",
    "ide.usePath": "Use it in code with this path:",
    "ide.copyPath": "Copy path",
    "ide.welcome": "Welcome to the BrioJS playground. Your files live in this browser (IndexedDB).",
    "ide.started": "Game started",
    "ide.stopped": "Game stopped",
    "ide.uncaught": "Uncaught error",
    "ide.swMissing":
        "The sandbox needs a Service Worker, which this browser blocked (private mode or an old browser). Games from the gallery still work.",
    "ide.importing": "Loading template…",
    "ide.importDone": "Template ready",
    "ide.exported": "Project exported",
    "ide.justNow": "just now",
    "ide.minutesAgo": "{n} min ago",
    "ide.hoursAgo": "{n} h ago",
    "ide.daysAgo": "{n} d ago",
    "ide.autoRun": "Run on save",
    "ide.docs": "Docs",
    "ide.home": "Home",
    "ide.shortcuts": "Ctrl+S save · Ctrl+Enter run · Ctrl+P files",
    "ide.files": "{n} files",
    "ide.reset": "Reset to template",
    "ide.confirmReset": "Replace every file of this project with the original template?",
    "ide.size": "Size",
    "ide.snippets": "Snippets",
    "ide.snippetHint": "Inserted at the cursor",
} as const;

type Strings = { [K in keyof typeof en]: string };

const pt: Strings = {
    "nav.games": "Jogos",
    "nav.how": "Como funciona",
    "nav.playground": "Playground",
    "nav.credits": "Créditos",
    "nav.menu": "Menu",
    "nav.github": "GitHub",
    "lang.label": "Idioma",

    "hero.eyebrow": "Engine de jogos open source · TypeScript · v{version}",
    "hero.title": "Faça jogos <em>com brio</em>.",
    "hero.lead":
        "O BrioJS é uma engine 2D e 3D para a web, sem nenhuma dependência. Amigável para a sua primeira linha de código e rápida o bastante para manter milhares de coisas se movendo a 60 fps.",
    "hero.play": "Jogar as demos",
    "hero.playground": "Abrir o playground",
    "hero.copy": "Copiar",
    "hero.copied": "Copiado!",
    "hero.caption":
        "Renderizado ao vivo pelo BrioJS: WebGL2, sombras suaves e um shader de água. Mexa o mouse para olhar em volta.",
    "hero.fps": "{fps} fps",
    "hero.loading": "esquentando a fonte termal…",
    "hero.fallback": "Seu navegador não conseguiu iniciar o WebGL2, então a cena ao vivo está descansando.",

    "brio.word": "brio",
    "brio.phonetic": "/ˈbɾi.u/ · substantivo masculino",
    "brio.def": "Capricho, garra e amor-próprio; o jeito de quem gosta de verdade do que está fazendo.",

    "bridge.eyebrow": "Por que existe",
    "bridge.title": "A subida suave entre os blocos e as engines grandes.",
    "bridge.body":
        "Ferramentas de blocos são um ótimo primeiro passo, e engines profissionais são um ótimo destino. O caminho entre elas é íngreme: instaladores, editores pesados, uma linguagem nova, um computador potente. O BrioJS fica no meio, com JavaScript e TypeScript de verdade rodando no navegador que você já tem.",
    "bridge.blocks": "Blocos",
    "bridge.blocks.note": "Scratch, GDevelop: ótimos para lógica, mas sem código de verdade.",
    "bridge.brio": "BrioJS",
    "bridge.brio.note": "Código real, uma aba do navegador, nada para instalar.",
    "bridge.pro": "Engines profissionais",
    "bridge.pro.note": "Unity, Unreal: poderosas, pesadas, um começo íngreme.",

    "mascot.eyebrow": "Conheça a mascote",
    "mascot.title": "A Capibrio mantém tudo tranquilo.",
    "mascot.body":
        "A capivara é a vizinha mais tranquila dos rios do Paraná. Pássaros, patos e até macacos sentam nela sem cerimônia. Essa também é a função da engine: uma base firme onde você empilha as suas ideias.",
    "mascot.note": "A Capibrio aparece pelo site, geralmente cochilando. Acorde-a com um jogo.",

    "code.eyebrow": "Seu primeiro jogo",
    "code.title": "Leia uma vez e você já entende o ciclo de vida.",
    "code.body":
        "Carregue os assets em <code>preload()</code>, monte o mundo em <code>load()</code> e altere-o a cada quadro em <code>update()</code>. Objetos são classes simples com propriedades documentadas, e o editor autocompleta todas elas.",
    "code.try": "Rodar isto no playground",
    "code.result": "Este mesmo código, rodando",
    "code.point.1": "Um ponto de entrada: <code>BrioGame</code> com os presets 2d, 3d ou hybrid.",
    "code.point.2": "Entrada como ações nomeadas: teclado, gamepad e toque na mesma linha.",
    "code.point.3": "WebGL2 primeiro, com um fallback em Canvas2D que mantém o jogo rodando.",

    "games.eyebrow": "Feito com BrioJS",
    "games.title": "Jogos de demonstração",
    "games.body":
        "Quatro jogos pequenos, quatro estilos diferentes: pixel art desenhada na GPU, uma floresta low-poly, vidro brilhante e uma impressão em risografia. Cada um abre no playground com o código completo.",
    "games.play": "Jogar",
    "games.edit": "Abrir o código no playground",
    "games.controls": "Controles",

    "features.eyebrow": "Por dentro",
    "features.title": "Amigável por fora. Orientada a dados por dentro.",
    "features.ecs.title": "Classes por cima, typed arrays por baixo",
    "features.ecs.body":
        "Você escreve <code>player.transform.position.x += 5</code>. A engine guarda isso num ECS em Structure of Arrays com handles geracionais, e o game loop não aloca nada.",
    "features.render.title": "WebGL2 primeiro, nunca uma tela em branco",
    "features.render.body":
        "Uma cascata de backends escolhe o WebGL2 e cai para um rasterizador em Canvas2D. Ambos carregam sob demanda, então um jogo 2D nunca baixa o renderizador 3D.",
    "features.light.title": "Iluminação bonita por padrão",
    "features.light.body":
        "Luzes pontuais, spot e direcionais, shading metallic-roughness, sombras suaves, neblina, tone mapping e hooks em GLSL quando você quiser um visual próprio.",
    "features.save.title": "Salve qualquer coisa, na hora",
    "features.save.body":
        "Checkpoints capturam todos os objetos, cenas e a semente aleatória num snapshot binário que continua legível entre versões da engine.",
    "features.zero.title": "Zero dependências",
    "features.zero.body":
        "Nenhum pacote em tempo de execução. Módulos ES pelo npm ou por CDN, com tree-shaking e declarações TypeScript inclusas.",
    "features.docs.title": "Documentada em todo lugar",
    "features.docs.body":
        "Toda classe e método público tem TSDoc com exemplos, então o editor explica a engine enquanto você digita.",
    "stats.deps": "dependências em runtime",
    "stats.tests": "testes automatizados",
    "stats.size": "engine minificada",
    "stats.dims": "dimensões, uma API",

    "teaser.eyebrow": "O playground",
    "teaser.title": "Um estúdio de jogos numa aba do navegador.",
    "teaser.body":
        "Escreva código com autocomplete, arraste sprites, modelos e sons e aperte Rodar. Os projetos ficam salvos no seu próprio navegador: sem conta, sem instalação, sem upload.",
    "teaser.cta": "Começar a criar",
    "teaser.point.1": "Editor Monaco com todas as definições de tipo do BrioJS",
    "teaser.point.2": "Arraste e solte imagens, áudio, glTF e GLSL",
    "teaser.point.3": "Console, erros e preview ao vivo lado a lado",
    "teaser.point.4": "Exporte o projeto em .zip quando quiser",

    "tcc.eyebrow": "De onde vem",
    "tcc.title": "Nasceu como trabalho de conclusão de curso no Paraná.",
    "tcc.body":
        "O BrioJS começou como TCC do curso de Tecnologia em Análise e Desenvolvimento de Sistemas do IFPR, Campus Colombo, estudando como ensinar desenvolvimento de jogos com código real e uma arquitetura de engine moderna.",
    "tcc.authors": "Autores",
    "tcc.advisor": "Orientadora",

    "footer.tagline": "Feito no Paraná, com brio.",
    "footer.license": "Licença MIT. Os assets das demos pertencem aos seus criadores.",
    "footer.credits": "Créditos dos assets",
    "footer.docs": "Documentação",
    "footer.npm": "Pacote no npm",

    "play.back": "Todos os jogos",
    "play.restart": "Reiniciar",
    "play.fullscreen": "Tela cheia",
    "play.edit": "Editar no playground",
    "play.controls": "Controles",
    "play.about": "Sobre este jogo",
    "play.credits": "Créditos",
    "play.features": "Recursos da engine usados",
    "play.notfound": "Esse jogo se perdeu por aí. Que tal escolher outro?",
    "play.clickToStart": "Clique para começar",
    "play.loading": "Carregando…",
    "notfound.title": "A Capibrio não encontrou esta página.",
    "notfound.body": "Ela deve estar cochilando em outro lugar. Estes caminhos continuam funcionando:",

    "credits.title": "Créditos",
    "credits.body":
        "Os jogos de demonstração usam assets gratuitos feitos por artistas generosos. Obrigado! Cada item leva à página original e à sua licença.",
    "credits.game": "Jogo",
    "credits.asset": "Asset",
    "credits.author": "Autor",
    "credits.license": "Licença",
    "credits.engine":
        "O BrioJS, este site e o playground são trabalho original sob a licença MIT. A Capibrio foi desenhada para este site.",
    "credits.fonts":
        "Fontes (SIL Open Font License, via Google Fonts): Fraunces, Bricolage Grotesque e JetBrains Mono no site; Pixelify Sans, Fredoka, Outfit, Archivo Black e Space Mono nos jogos. Editor: Monaco (MIT).",

    "ide.run": "Rodar",
    "ide.stop": "Parar",
    "ide.runHint": "Rodar (Ctrl+Enter)",
    "ide.projects": "Projetos",
    "ide.explorer": "Arquivos",
    "ide.newFile": "Novo arquivo",
    "ide.newFolder": "Nova pasta",
    "ide.upload": "Adicionar assets",
    "ide.export": "Exportar .zip",
    "ide.import": "Importar .zip",
    "ide.console": "Console",
    "ide.clear": "Limpar",
    "ide.preview": "Jogo",
    "ide.reload": "Recarregar",
    "ide.popout": "Abrir em nova aba",
    "ide.saved": "Salvo neste navegador",
    "ide.saving": "Salvando…",
    "ide.dropHere": "Solte os arquivos para adicioná-los ao projeto",
    "ide.emptyPreview": "A Capibrio está cochilando. Aperte Rodar para acordá-la com o seu jogo.",
    "ide.rename": "Renomear",
    "ide.delete": "Excluir",
    "ide.duplicate": "Duplicar",
    "ide.confirmDelete": "Excluir {name}? Não dá para desfazer.",
    "ide.confirmDeleteProject": "Excluir o projeto \"{name}\" e todos os seus arquivos deste navegador?",
    "ide.promptFile": "Nome do arquivo (pode usar pastas, ex.: src/player.js)",
    "ide.promptFolder": "Nome da pasta",
    "ide.promptRename": "Novo nome",
    "ide.promptProject": "Nome do projeto",
    "ide.newProject": "Novo projeto",
    "ide.myProjects": "Meus projetos",
    "ide.templates": "Começar de",
    "ide.templateBlank2d": "2D em branco",
    "ide.templateBlank2dDesc": "Um sprite numa câmera ortográfica em WebGL2, com controles.",
    "ide.templateBlank3d": "3D em branco",
    "ide.templateBlank3dDesc": "Um cubo iluminado, sombras e uma câmera orbitando.",
    "ide.open": "Abrir",
    "ide.updated": "editado {when}",
    "ide.noProjects": "Nenhum projeto ainda. Escolha um ponto de partida abaixo.",
    "ide.binary": "Arquivo binário",
    "ide.preview.image": "Prévia da imagem",
    "ide.preview.audio": "Prévia do áudio",
    "ide.preview.other": "Este arquivo é usado pelo seu jogo, mas não pode ser editado aqui.",
    "ide.usePath": "Use no código com este caminho:",
    "ide.copyPath": "Copiar caminho",
    "ide.welcome": "Boas-vindas ao playground do BrioJS. Seus arquivos ficam neste navegador (IndexedDB).",
    "ide.started": "Jogo iniciado",
    "ide.stopped": "Jogo parado",
    "ide.uncaught": "Erro não tratado",
    "ide.swMissing":
        "O sandbox precisa de um Service Worker, que este navegador bloqueou (modo privado ou navegador antigo). Os jogos da galeria continuam funcionando.",
    "ide.importing": "Carregando modelo…",
    "ide.importDone": "Modelo pronto",
    "ide.exported": "Projeto exportado",
    "ide.justNow": "agora mesmo",
    "ide.minutesAgo": "há {n} min",
    "ide.hoursAgo": "há {n} h",
    "ide.daysAgo": "há {n} d",
    "ide.autoRun": "Rodar ao salvar",
    "ide.docs": "Docs",
    "ide.home": "Início",
    "ide.shortcuts": "Ctrl+S salvar · Ctrl+Enter rodar · Ctrl+P arquivos",
    "ide.files": "{n} arquivos",
    "ide.reset": "Restaurar modelo",
    "ide.confirmReset": "Substituir todos os arquivos deste projeto pelo modelo original?",
    "ide.size": "Tamanho",
    "ide.snippets": "Trechos",
    "ide.snippetHint": "Inserido no cursor",
};

export const strings = { en: en as Strings, pt };
