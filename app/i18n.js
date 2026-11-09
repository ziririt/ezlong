/* EZLONG 앱 허브·ezScan 소개 공용 다국어 (2026-11-09).
 * 열쇠는 한국어 원문(공백은 한 칸으로 접어 맞춘다). 표에 없는 문구는 영어, 그것도 없으면 한국어 그대로.
 * 행 형식: [한국어, [en, ja, zh-CN, zh-TW, es, fr, de, pt, vi, it]]
 * 기계 번역 API 를 쓰지 않고 Claude 가 문맥을 보고 옮겼다. 원어민 검수 전.
 * 언어 고르는 순서: ?lang= → 저장한 선택(localStorage) → 브라우저 언어 → 한국어.
 * 문서의 lang 속성을 함께 바꾼다(apps-nav.js 가 이 값을 보고 앱 이름을 바꾼다). */
(function () {
  'use strict';
  var LANGS = [
    ['ko', '한국어'], ['en', 'English'], ['ja', '日本語'], ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'],
    ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['pt', 'Português'], ['vi', 'Tiếng Việt'],
    ['it', 'Italiano']
  ];
  var IDX = { en: 0, ja: 1, 'zh-CN': 2, 'zh-TW': 3, es: 4, fr: 5, de: 6, pt: 7, vi: 8, it: 9 };
  var K = [
    ['앱: EZLONG · 웹진, 노트, 시계, 충전, 사진 액자, 사진 이어붙이기, PDF, 파일 변환, 문서 스캔, 전자책 번역, 파일 공유', [
      'Apps: EZLONG · Webzine, Notes, Clock, Charging, Photo Frame, Screenshot Stitching, PDF, File Converter, Document Scanner, eBook Translation, File Sharing',
      'アプリ: EZLONG · Webマガジン、ノート、時計、充電、フォトフレーム、画像つなぎ合わせ、PDF、ファイル変換、書類スキャン、電子書籍翻訳、ファイル共有',
      '应用：EZLONG · 网刊、笔记、时钟、充电、相框、长截图拼接、PDF、文件转换、文档扫描、电子书翻译、文件分享',
      '應用程式：EZLONG · 網刊、筆記、時鐘、充電、相框、長截圖拼接、PDF、檔案轉換、文件掃描、電子書翻譯、檔案分享',
      'Apps: EZLONG · revista web, notas, reloj, carga, marco de fotos, unir capturas, PDF, conversor de archivos, escáner de documentos, traducción de eBooks, compartir archivos',
      'Apps : EZLONG · webzine, notes, horloge, recharge, cadre photo, assemblage de captures, PDF, convertisseur de fichiers, scanner de documents, traduction d’eBooks, partage de fichiers',
      'Apps: EZLONG · Webzine, Notizen, Uhr, Laden, Bilderrahmen, Screenshots verbinden, PDF, Dateikonverter, Dokumentenscanner, E-Book-Übersetzung, Dateien teilen',
      'Apps: EZLONG · webzine, notas, relógio, carregamento, porta-retratos, unir capturas, PDF, conversor de arquivos, scanner de documentos, tradução de eBooks, compartilhar arquivos',
      'Ứng dụng: EZLONG · tạp chí web, ghi chú, đồng hồ, sạc, khung ảnh, ghép ảnh chụp màn hình, PDF, chuyển đổi tệp, quét tài liệu, dịch sách điện tử, chia sẻ tệp',
      'App: EZLONG · Webzine, Note, Orologio, Ricarica, Cornice foto, Unione di screenshot, PDF, Convertitore di file, Scanner di documenti, Traduzione eBook, Condivisione file']],
    ['앱: EZLONG · 웹진, 노트, 시계, 충전, 사진 액자, 이어붙이기, PDF, 변환, 스캔, 전자책 번역, 파일 공유', [
      'Apps: EZLONG · Webzine, Notes, Clock, Charging, Photo Frame, Stitching, PDF, Converter, Scanner, eBook Translation, File Sharing',
      'アプリ: EZLONG · Webマガジン、ノート、時計、充電、フォトフレーム、画像結合、PDF、変換、スキャン、電子書籍翻訳、ファイル共有',
      '应用：EZLONG · 网刊、笔记、时钟、充电、相框、拼接、PDF、转换、扫描、电子书翻译、文件分享',
      '應用程式：EZLONG · 網刊、筆記、時鐘、充電、相框、拼接、PDF、轉換、掃描、電子書翻譯、檔案分享',
      'Apps: EZLONG · revista web, notas, reloj, carga, marco de fotos, unir capturas, PDF, conversor, escáner, traducción de eBooks, compartir archivos',
      'Apps : EZLONG · webzine, notes, horloge, recharge, cadre photo, assemblage, PDF, convertisseur, scanner, traduction d’eBooks, partage de fichiers',
      'Apps: EZLONG · Webzine, Notizen, Uhr, Laden, Bilderrahmen, Verbinden, PDF, Konverter, Scanner, E-Book-Übersetzung, Dateien teilen',
      'Apps: EZLONG · webzine, notas, relógio, carregamento, porta-retratos, unir capturas, PDF, conversor, scanner, tradução de eBooks, compartilhar arquivos',
      'Ứng dụng: EZLONG · tạp chí web, ghi chú, đồng hồ, sạc, khung ảnh, ghép ảnh, PDF, chuyển đổi, quét, dịch sách điện tử, chia sẻ tệp',
      'App: EZLONG · Webzine, Note, Orologio, Ricarica, Cornice foto, Unione, PDF, Convertitore, Scanner, Traduzione eBook, Condivisione file']],
    ['EZLONG이 만든 무료 앱 모음: 미국 주식 웹진 Insight Times, 플립시계 기상 알람 Long Time, Easy Life, AI 답변 정리 노트 Skyblue Note, 충전 속도를 보여 주는 배터리 라이프, 사진 액자 시계 포토 타임, 스크린샷 이어붙이기 LongLong, 무엇이든 PDF로 Any to PDF, 기기 안 파일 변환 Ez Converter, 원샷 문서 스캐너 ezScan, 전자책·파일 나란히 번역 ReadTrans, 코드 6자리 파일 공유 send.ezlong.com.', [
      'Free apps by EZLONG: US stock webzine Insight Times, flip clock and wake-up alarm Long Time, Easy Life, AI answer cleanup notes Skyblue Note, Battery Life showing charging speed, photo frame clock Photo Time, screenshot stitching LongLong, anything-to-PDF Any to PDF, on-device file converter Ez Converter, one-shot document scanner ezScan, side-by-side Kindle, Apple Books and file translation ReadTrans (Translate Any eBook Reader or File), and 6-digit-code file sharing send.ezlong.com.',
      'EZLONGが作った無料アプリ集: 米国株Webマガジン Insight Times、フリップ時計の目覚まし Long Time, Easy Life、AIの回答を整えるノート Skyblue Note、充電速度がわかる Battery Life、フォトフレーム時計 Photo Time、スクリーンショットを長くつなぐ LongLong、何でもPDFにする Any to PDF、端末内ファイル変換 Ez Converter、ワンショット書類スキャナー ezScan、Kindle・Apple Booksやファイルを並べて翻訳する ReadTrans、6桁コードのファイル共有 send.ezlong.com。',
      'EZLONG 出品的免费应用合集：美股网刊 Insight Times、翻页时钟与起床闹钟 Long Time, Easy Life、整理 AI 回答的笔记 Skyblue Note、显示充电速度的 Battery Life、相框时钟 Photo Time、长截图拼接 LongLong、万能转 PDF 的 Any to PDF、设备内文件转换 Ez Converter、一拍即成的文档扫描 ezScan、Kindle、Apple Books 与文件对照翻译 ReadTrans、6 位码文件分享 send.ezlong.com。',
      'EZLONG 推出的免費應用程式合集：美股網刊 Insight Times、翻頁時鐘與起床鬧鐘 Long Time, Easy Life、整理 AI 回答的筆記 Skyblue Note、顯示充電速度的 Battery Life、相框時鐘 Photo Time、長截圖拼接 LongLong、萬能轉 PDF 的 Any to PDF、裝置內檔案轉換 Ez Converter、一拍即成的文件掃描 ezScan、Kindle、Apple Books 與檔案對照翻譯 ReadTrans、6 位數代碼檔案分享 send.ezlong.com。',
      'Apps gratuitas de EZLONG: la revista web de bolsa estadounidense Insight Times, el reloj de paletas con alarma Long Time, Easy Life, las notas que limpian respuestas de IA Skyblue Note, Battery Life con la velocidad de carga, el reloj con marco de fotos Photo Time, el unificador de capturas LongLong, Any to PDF para convertir cualquier cosa en PDF, el conversor de archivos en el dispositivo Ez Converter, el escáner de documentos ezScan, la traducción en paralelo para Kindle, Apple Books y archivos ReadTrans, y send.ezlong.com para compartir archivos con un código de 6 dígitos.',
      'Les apps gratuites d’EZLONG : le webzine boursier américain Insight Times, l’horloge à palettes avec réveil Long Time, Easy Life, les notes qui nettoient les réponses d’IA Skyblue Note, Battery Life et sa vitesse de recharge, l’horloge cadre photo Photo Time, l’assemblage de captures LongLong, Any to PDF pour tout convertir en PDF, le convertisseur local Ez Converter, le scanner de documents ezScan, la traduction côte à côte pour Kindle, Apple Books et fichiers ReadTrans, et send.ezlong.com pour partager des fichiers avec un code à 6 chiffres.',
      'Kostenlose Apps von EZLONG: das US-Börsen-Webzine Insight Times, die Flipuhr mit Weckalarm Long Time, Easy Life, die Notizen zum Aufräumen von KI-Antworten Skyblue Note, Battery Life mit Ladegeschwindigkeit, die Bilderrahmen-Uhr Photo Time, das Screenshot-Verbinden LongLong, Any to PDF für alles als PDF, der Dateikonverter auf dem Gerät Ez Converter, der Ein-Klick-Dokumentenscanner ezScan, die Übersetzung nebeneinander für Kindle, Apple Books und Dateien ReadTrans sowie Dateien teilen per 6-stelligem Code mit send.ezlong.com.',
      'Apps gratuitos da EZLONG: o webzine de ações americanas Insight Times, o relógio de pás com alarme Long Time, Easy Life, as notas que organizam respostas de IA Skyblue Note, o Battery Life com a velocidade de carregamento, o relógio porta-retratos Photo Time, o unificador de capturas LongLong, o Any to PDF para transformar qualquer coisa em PDF, o conversor de arquivos no dispositivo Ez Converter, o scanner de documentos ezScan, a tradução lado a lado para Kindle, Apple Books e arquivos ReadTrans e o send.ezlong.com para compartilhar arquivos com código de 6 dígitos.',
      'Bộ ứng dụng miễn phí của EZLONG: tạp chí web chứng khoán Mỹ Insight Times, đồng hồ lật kèm báo thức Long Time, Easy Life, ghi chú dọn dẹp câu trả lời AI Skyblue Note, Battery Life hiển thị tốc độ sạc, đồng hồ khung ảnh Photo Time, ghép ảnh chụp màn hình LongLong, biến mọi thứ thành PDF với Any to PDF, chuyển đổi tệp ngay trên thiết bị Ez Converter, máy quét tài liệu một lần chạm ezScan, dịch song song cho Kindle, Apple Books và tệp ReadTrans, cùng chia sẻ tệp bằng mã 6 số send.ezlong.com.',
      'App gratuite di EZLONG: il webzine sulla Borsa USA Insight Times, l’orologio flip con sveglia Long Time, Easy Life, le note che puliscono le risposte dell’IA Skyblue Note, Battery Life con la velocità di ricarica, l’orologio cornice foto Photo Time, l’unione di screenshot LongLong, Any to PDF per trasformare tutto in PDF, il convertitore di file sul dispositivo Ez Converter, lo scanner di documenti in un colpo solo ezScan, la traduzione affiancata per Kindle, Apple Books e file ReadTrans e la condivisione di file con codice a 6 cifre send.ezlong.com.']],
    ['Insight Times, Long Time, Easy Life, Skyblue Note, 배터리 라이프, 포토 타임, LongLong, Any to PDF, Ez Converter, ezScan, ReadTrans, 초간단 파일공유. EZLONG이 만든 앱을 한곳에.', [
      'Insight Times, Long Time, Easy Life, Skyblue Note, Battery Life, Photo Time, LongLong, Any to PDF, Ez Converter, ezScan, ReadTrans, Quick File Share. All the apps made by EZLONG in one place.',
      'Insight Times、Long Time, Easy Life、Skyblue Note、Battery Life、Photo Time、LongLong、Any to PDF、Ez Converter、ezScan、ReadTrans、かんたんファイル共有。EZLONGのアプリをひとまとめに。',
      'Insight Times、Long Time, Easy Life、Skyblue Note、Battery Life、Photo Time、LongLong、Any to PDF、Ez Converter、ezScan、ReadTrans、极简文件分享。EZLONG 出品的应用，一站集合。',
      'Insight Times、Long Time, Easy Life、Skyblue Note、Battery Life、Photo Time、LongLong、Any to PDF、Ez Converter、ezScan、ReadTrans、極簡檔案分享。EZLONG 推出的應用程式，一站集合。',
      'Insight Times, Long Time, Easy Life, Skyblue Note, Battery Life, Photo Time, LongLong, Any to PDF, Ez Converter, ezScan, ReadTrans, Compartir archivos rápido. Todas las apps de EZLONG en un solo lugar.',
      'Insight Times, Long Time, Easy Life, Skyblue Note, Battery Life, Photo Time, LongLong, Any to PDF, Ez Converter, ezScan, ReadTrans, Partage de fichiers express. Toutes les apps d’EZLONG au même endroit.',
      'Insight Times, Long Time, Easy Life, Skyblue Note, Battery Life, Photo Time, LongLong, Any to PDF, Ez Converter, ezScan, ReadTrans, Dateien blitzschnell teilen. Alle Apps von EZLONG an einem Ort.',
      'Insight Times, Long Time, Easy Life, Skyblue Note, Battery Life, Photo Time, LongLong, Any to PDF, Ez Converter, ezScan, ReadTrans, Compartilhar arquivos rápido. Todos os apps da EZLONG em um só lugar.',
      'Insight Times, Long Time, Easy Life, Skyblue Note, Battery Life, Photo Time, LongLong, Any to PDF, Ez Converter, ezScan, ReadTrans, Chia sẻ tệp nhanh. Tất cả ứng dụng của EZLONG ở một nơi.',
      'Insight Times, Long Time, Easy Life, Skyblue Note, Battery Life, Photo Time, LongLong, Any to PDF, Ez Converter, ezScan, ReadTrans, Quick File Share. Tutte le app di EZLONG in un unico posto.']],
    ['EZLONG이 만든 앱', [
      'Apps made by EZLONG', 'EZLONGのアプリ', 'EZLONG 出品的应用', 'EZLONG 推出的應用程式', 'Apps creadas por EZLONG', 'Les apps créées par EZLONG',
      'Apps von EZLONG', 'Apps criados pela EZLONG', 'Ứng dụng do EZLONG tạo ra', 'Le app create da EZLONG']],
    ['웹진 · 미국 주식', [
      'Webzine · US stocks', 'Webマガジン · 米国株', '网刊 · 美股', '網刊 · 美股', 'Revista web · Bolsa de EE. UU.', 'Webzine · Bourse américaine',
      'Webzine · US-Aktien', 'Webzine · Ações dos EUA', 'Tạp chí web · Chứng khoán Mỹ', 'Webzine · Borsa USA']],
    ['Insight Times 열기', [
      'Open Insight Times', 'Insight Timesを開く', '打开 Insight Times', '開啟 Insight Times', 'Abrir Insight Times', 'Ouvrir Insight Times',
      'Insight Times öffnen', 'Abrir o Insight Times', 'Mở Insight Times', 'Apri Insight Times']],
    ['AI 시대 투자자의 인사이트. 반도체와 빅테크, 금리와 유가가 어느 회사의 손익에 언제 닿는지를 풀어 씁니다. 평일 아침에는 전날 미국장 마감 시황, 월요일에는 한 주 전망이 올라오고, 뉴스레터로도 받아 볼 수 있습니다. 홈 화면에 올려 두면 앱처럼 열립니다.', [
      'Insight for investors in the AI era. We explain when semiconductors, Big Tech, interest rates and oil prices reach which company’s bottom line. Weekday mornings bring the previous day’s US market close, Mondays bring the week-ahead outlook, and both also arrive by newsletter. Add it to your home screen and it opens like an app.',
      'AI時代の投資家のためのインサイト。半導体とビッグテック、金利と原油価格が、どの企業の損益にいつ届くのかを読み解きます。平日の朝は前日の米国市場の引け後レポート、月曜日は週間見通しを掲載し、ニュースレターでも受け取れます。ホーム画面に追加すれば、アプリのように開けます。',
      'AI 时代投资者的洞见。解读半导体与大型科技股、利率与油价，何时会传导到哪家公司的损益。工作日早晨更新前一日美股收盘行情，周一发布本周展望，也可通过邮件简报订阅。添加到主屏幕后，像应用一样打开。',
      'AI 時代投資人的洞見。解讀半導體與大型科技股、利率與油價，何時會傳導到哪家公司的損益。平日早晨更新前一日美股收盤行情，週一發布本週展望，也可透過電子報訂閱。加入主畫面後，就能像 App 一樣開啟。',
      'Análisis para inversores de la era de la IA. Explicamos cuándo los semiconductores, las grandes tecnológicas, los tipos de interés y el petróleo llegan a la cuenta de resultados de cada empresa. Los días laborables por la mañana, el cierre del mercado estadounidense del día anterior; los lunes, las perspectivas de la semana. También por newsletter. Añádela a la pantalla de inicio y se abre como una app.',
      'Le regard des investisseurs à l’ère de l’IA. Nous expliquons quand les semi-conducteurs, les géants de la tech, les taux et le pétrole atteignent le résultat de chaque entreprise. En semaine, la clôture de Wall Street de la veille ; le lundi, les perspectives de la semaine, aussi par newsletter. Ajoutez-le à l’écran d’accueil pour l’ouvrir comme une app.',
      'Einblicke für Anleger im KI-Zeitalter. Wir erklären, wann Halbleiter, Big Tech, Zinsen und Ölpreise bei welchem Unternehmen im Ergebnis ankommen. Werktags morgens der US-Handelsschluss des Vortags, montags der Ausblick auf die Woche – auch per Newsletter. Auf dem Home-Bildschirm abgelegt, öffnet es sich wie eine App.',
      'Insights para investidores na era da IA. Explicamos quando semicondutores, big techs, juros e petróleo chegam ao resultado de cada empresa. Nas manhãs de dias úteis, o fechamento do mercado americano do dia anterior; às segundas, as perspectivas da semana — também por newsletter. Adicione à tela inicial e abra como um app.',
      'Góc nhìn dành cho nhà đầu tư thời AI. Chúng tôi phân tích khi nào chip bán dẫn, Big Tech, lãi suất và giá dầu tác động đến lợi nhuận của từng công ty. Sáng các ngày trong tuần có bản tin đóng cửa thị trường Mỹ hôm trước, thứ Hai có nhận định cả tuần, và cũng gửi qua bản tin email. Thêm vào màn hình chính để mở như một ứng dụng.',
      'Insight per gli investitori dell’era dell’IA. Spieghiamo quando semiconduttori, Big Tech, tassi di interesse e prezzo del petrolio arrivano al bilancio di ciascuna azienda. Nei giorni feriali al mattino trovi la chiusura del mercato USA del giorno prima, il lunedì le prospettive della settimana, e il tutto arriva anche via newsletter. Aggiungilo alla schermata Home e si apre come un’app.']],
    ['Insight Times 첫 화면', [
      'Insight Times home screen', 'Insight Timesのトップ画面', 'Insight Times 首页', 'Insight Times 首頁', 'Pantalla de inicio de Insight Times', 'Écran d’accueil d’Insight Times',
      'Startseite von Insight Times', 'Tela inicial do Insight Times', 'Màn hình chính của Insight Times', 'Schermata Home di Insight Times']],
    ['첫 화면', ['Home screen', 'トップ画面', '首页', '首頁', 'Pantalla de inicio', 'Écran d’accueil', 'Startseite', 'Tela inicial', 'Màn hình chính', 'Schermata Home']],
    ['기사 머리와 태그', [
      'Article header and tags', '記事の見出しとタグ', '文章标题与标签', '文章標題與標籤', 'Cabecera del artículo y etiquetas', 'En-tête d’article et tags',
      'Artikelkopf und Tags', 'Cabeçalho do artigo e tags', 'Tiêu đề bài viết và thẻ', 'Intestazione e tag dell’articolo']],
    ['기사', ['Article', '記事', '文章', '文章', 'Artículo', 'Article', 'Artikel', 'Artigo', 'Bài viết', 'Articolo']],
    ['숫자를 크게 세운 기사 속 수치판', [
      'In-article figures panel with large numbers', '数字を大きく見せる記事内の数値パネル', '文章中以大号数字呈现的数据面板', '文章中以大字數字呈現的數據面板', 'Panel de cifras del artículo con números grandes', 'Panneau de chiffres clés en grand dans un article',
      'Zahlentafel im Artikel mit großen Zahlen', 'Painel de números do artigo em destaque', 'Bảng số liệu trong bài với chữ số lớn', 'Pannello di cifre nell’articolo con numeri grandi']],
    ['숫자로 읽기', ['Read by the numbers', '数字で読む', '用数字读懂', '用數字讀懂', 'Leer con cifras', 'Lire en chiffres', 'In Zahlen lesen', 'Ler pelos números', 'Đọc qua con số', 'Leggi i numeri']],
    ['Insight Times 영문판 첫 화면', [
      'Insight Times English edition home screen', 'Insight Times英語版のトップ画面', 'Insight Times 英文版首页', 'Insight Times 英文版首頁', 'Pantalla de inicio de la edición en inglés de Insight Times', 'Écran d’accueil de l’édition anglaise d’Insight Times',
      'Startseite der englischen Ausgabe von Insight Times', 'Tela inicial da edição em inglês do Insight Times', 'Màn hình chính của bản tiếng Anh Insight Times', 'Schermata Home dell’edizione inglese di Insight Times']],
    ['영문판', ['English edition', '英語版', '英文版', '英文版', 'Edición en inglés', 'Édition anglaise', 'Englische Ausgabe', 'Edição em inglês', 'Bản tiếng Anh', 'Edizione inglese']],
    ['웹진 열기', ['Open webzine', 'Webマガジンを開く', '打开网刊', '開啟網刊', 'Abrir la revista web', 'Ouvrir le webzine', 'Webzine öffnen', 'Abrir o webzine', 'Mở tạp chí web', 'Apri il webzine']],
    ['설치 없이', ['no install', 'インストール不要', '无需安装', '無需安裝', 'sin instalar', 'sans installation', 'ohne Installation', 'sem instalar', 'không cần cài đặt', 'nessuna installazione']],
    ['뉴스레터 받기', ['Get the newsletter', 'ニュースレターを受け取る', '订阅邮件简报', '訂閱電子報', 'Recibir la newsletter', 'Recevoir la newsletter', 'Newsletter abonnieren', 'Receber a newsletter', 'Nhận bản tin email', 'Iscriviti alla newsletter']],
    ['홈 화면에 추가하면 앱처럼', [
      'Add to home screen to use it like an app', 'ホーム画面に追加するとアプリのように', '添加到主屏幕，像应用一样使用', '加入主畫面，就像 App 一樣', 'Añádela a la pantalla de inicio y úsala como una app', 'Ajoutez à l’écran d’accueil : comme une app',
      'Auf den Home-Bildschirm legen – wie eine App', 'Adicione à tela inicial e use como um app', 'Thêm vào màn hình chính để dùng như ứng dụng', 'Aggiungilo alla schermata Home per usarlo come un’app']],
    ['시계 · 스탠바이', ['Clock · StandBy', '時計 · スタンバイ', '时钟 · 待机模式', '時鐘 · 待機模式', 'Reloj · StandBy', 'Horloge · StandBy', 'Uhr · StandBy', 'Relógio · StandBy', 'Đồng hồ · StandBy', 'Orologio · StandBy']],
    ['Long Time, Easy Life 소개 보기', [
      'See about Long Time, Easy Life', 'Long Time, Easy Lifeの紹介を見る', '查看 Long Time, Easy Life 介绍', '查看 Long Time, Easy Life 介紹', 'Ver información de Long Time, Easy Life', 'Découvrir Long Time, Easy Life',
      'Mehr über Long Time, Easy Life', 'Conhecer o Long Time, Easy Life', 'Xem giới thiệu Long Time, Easy Life', 'Scopri Long Time, Easy Life']],
    ['충전기에 꽂아 가로로 세워두면 큼직한 플립시계가 뜨고, 계절과 날씨와 시간에 맞춰 배경 사진과 영상이 저절로 바뀝니다. 지금 날씨와 시간별·주간 예보를 그 자리에서 보고, 아래로는 투자 거장들의 문장이 흘러가고, 일하거나 공부할 때 듣기 좋은 음악도 함께 깔립니다.', [
      'Plug in your phone and stand it sideways: a big flip clock appears, and the background photos and videos change on their own with the season, weather and time of day. See current weather plus hourly and weekly forecasts right there, while quotes from investing legends scroll below and calm music plays for work or study.',
      '充電器につないで横向きに立てると、大きなフリップ時計が表示され、季節・天気・時間帯に合わせて背景の写真や動画が自動で切り替わります。現在の天気や時間別・週間予報をその場で確認でき、下には投資の巨匠たちの言葉が流れ、仕事や勉強にぴったりの音楽も一緒に流れます。',
      '插上充电器横放，就会显示大号翻页时钟，背景照片和视频会随季节、天气和时间自动切换。当前天气、逐时与一周预报一目了然，下方滚动着投资大师的名言，还有适合工作和学习的音乐相伴。',
      '插上充電器橫放，就會顯示大型翻頁時鐘，背景照片和影片會隨季節、天氣與時間自動切換。目前天氣、逐時與一週預報一目了然，下方捲動著投資大師的名言，還有適合工作與讀書的音樂相伴。',
      'Conéctalo al cargador y ponlo en horizontal: aparece un gran reloj de paletas y las fotos y vídeos de fondo cambian solos según la estación, el tiempo y la hora. Consulta al instante el tiempo actual y la previsión por horas y semanal, mientras abajo desfilan frases de grandes inversores y suena música tranquila para trabajar o estudiar.',
      'Branchez-le au chargeur et posez-le à l’horizontale : une grande horloge à palettes s’affiche et les photos et vidéos d’arrière-plan changent seules selon la saison, la météo et l’heure. Consultez sur place la météo actuelle et les prévisions horaires et hebdomadaires, pendant que défilent en bas les citations des grands investisseurs, avec une musique douce pour travailler ou étudier.',
      'Ans Ladegerät stecken und quer hinstellen: Eine große Flipuhr erscheint, und Hintergrundfotos und -videos wechseln von selbst mit Jahreszeit, Wetter und Tageszeit. Aktuelles Wetter sowie Stunden- und Wochenvorhersage sehen Sie direkt, unten laufen Zitate großer Investoren durch, und ruhige Musik begleitet Arbeit und Lernen.',
      'Conecte ao carregador e deixe na horizontal: um grande relógio de pás aparece e as fotos e vídeos de fundo mudam sozinhos conforme a estação, o clima e a hora. Veja na hora o tempo atual e as previsões por hora e da semana, enquanto embaixo passam frases de grandes investidores e uma música tranquila toca para trabalhar ou estudar.',
      'Cắm sạc và đặt ngang, một chiếc đồng hồ lật cỡ lớn sẽ hiện lên, ảnh và video nền tự đổi theo mùa, thời tiết và giờ trong ngày. Bạn xem ngay thời tiết hiện tại cùng dự báo theo giờ và theo tuần, bên dưới là những câu nói của các huyền thoại đầu tư, kèm nhạc nhẹ nhàng khi làm việc hay học tập.',
      'Collega il telefono alla corrente e mettilo in orizzontale: compare un grande orologio flip, mentre foto e video di sfondo cambiano da soli in base a stagione, meteo e ora del giorno. Vedi subito il meteo attuale con le previsioni orarie e settimanali, mentre sotto scorrono le citazioni dei grandi dell’investimento e una musica rilassante accompagna lavoro e studio.']],
    ['Long Time, Easy Life 플립시계 화면', [
      'Long Time, Easy Life flip clock screen', 'Long Time, Easy Lifeのフリップ時計画面', 'Long Time, Easy Life 翻页时钟画面', 'Long Time, Easy Life 翻頁時鐘畫面', 'Pantalla del reloj de paletas de Long Time, Easy Life', 'Écran de l’horloge à palettes de Long Time, Easy Life',
      'Flipuhr-Ansicht von Long Time, Easy Life', 'Tela do relógio de pás do Long Time, Easy Life', 'Màn hình đồng hồ lật của Long Time, Easy Life', 'Schermata dell’orologio flip di Long Time, Easy Life']],
    ['아이폰 · 스탠바이', ['iPhone · StandBy', 'iPhone · スタンバイ', 'iPhone · 待机模式', 'iPhone · 待機模式', 'iPhone · StandBy', 'iPhone · StandBy', 'iPhone · StandBy', 'iPhone · StandBy', 'iPhone · StandBy', 'iPhone · StandBy']],
    ['투자 거장의 문장이 흐르는 화면', [
      'Screen with quotes from investing legends scrolling by', '投資の巨匠の言葉が流れる画面', '滚动显示投资大师名言的画面', '捲動顯示投資大師名言的畫面', 'Pantalla con frases de grandes inversores', 'Écran où défilent les citations de grands investisseurs',
      'Ansicht mit durchlaufenden Zitaten großer Investoren', 'Tela com frases de grandes investidores passando', 'Màn hình với câu nói của các huyền thoại đầu tư chạy qua', 'Schermata con le citazioni dei grandi dell’investimento che scorrono']],
    ['거장의 문장', ['Words of the masters', '巨匠の言葉', '大师名言', '大師名言', 'Frases de los maestros', 'Citations des maîtres', 'Worte der Meister', 'Frases dos mestres', 'Lời của các bậc thầy', 'Parole dei maestri']],
    ['지금 날씨와 시간별·주간 예보 화면', [
      'Current weather and hourly and weekly forecast screen', '現在の天気と時間別・週間予報の画面', '当前天气与逐时、一周预报画面', '目前天氣與逐時、一週預報畫面', 'Pantalla del tiempo actual y previsión por horas y semanal', 'Écran de la météo actuelle et des prévisions horaires et hebdomadaires',
      'Ansicht mit aktuellem Wetter sowie Stunden- und Wochenvorhersage', 'Tela com o tempo atual e previsões por hora e da semana', 'Màn hình thời tiết hiện tại và dự báo theo giờ, theo tuần', 'Schermata con il meteo attuale e le previsioni orarie e settimanali']],
    ['날씨 · 예보', ['Weather · Forecast', '天気 · 予報', '天气 · 预报', '天氣 · 預報', 'Tiempo · Previsión', 'Météo · Prévisions', 'Wetter · Vorhersage', 'Clima · Previsão', 'Thời tiết · Dự báo', 'Meteo · Previsioni']],
    ['Apple Watch 화면', ['Apple Watch screen', 'Apple Watchの画面', 'Apple Watch 画面', 'Apple Watch 畫面', 'Pantalla del Apple Watch', 'Écran de l’Apple Watch', 'Apple-Watch-Ansicht', 'Tela do Apple Watch', 'Màn hình Apple Watch', 'Schermata di Apple Watch']],
    ['웹앱 열기', ['Open web app', 'Webアプリを開く', '打开网页版', '開啟網頁版', 'Abrir la app web', 'Ouvrir l’app web', 'Web-App öffnen', 'Abrir o app web', 'Mở ứng dụng web', 'Apri la web app']],
    ['소개 보기', ['Learn more', '紹介を見る', '查看介绍', '查看介紹', 'Ver información', 'En savoir plus', 'Mehr erfahren', 'Saiba mais', 'Xem giới thiệu', 'Scopri di più']],
    ['테스트 중', ['in testing', 'テスト中', '测试中', '測試中', 'en pruebas', 'en test', 'im Test', 'em teste', 'đang thử nghiệm', 'in fase di test']],
    ['Apple Watch 지원', ['Apple Watch supported', 'Apple Watch対応', '支持 Apple Watch', '支援 Apple Watch', 'Compatible con Apple Watch', 'Compatible Apple Watch', 'Mit Apple Watch', 'Compatível com Apple Watch', 'Hỗ trợ Apple Watch', 'Compatibile con Apple Watch']],
    ['노트 · 메모', ['Notes · Memos', 'ノート · メモ', '笔记 · 备忘', '筆記 · 備忘', 'Notas · Apuntes', 'Notes · Mémos', 'Notizen · Memos', 'Notas · Anotações', 'Ghi chú · Ghi nhớ', 'Note · Appunti']],
    ['Skyblue Note 소개 보기', [
      'See about Skyblue Note', 'Skyblue Noteの紹介を見る', '查看 Skyblue Note 介绍', '查看 Skyblue Note 介紹', 'Ver información de Skyblue Note', 'Découvrir Skyblue Note',
      'Mehr über Skyblue Note', 'Conhecer o Skyblue Note', 'Xem giới thiệu Skyblue Note', 'Scopri Skyblue Note']],
    ['ChatGPT·클로드·그록이 준 답을 붙여넣고 한 번 누르면 마크다운 별표와 우물 정이 걷히고 깨진 표가 다시 서 엑셀로 바로 복사됩니다. 화면에서는 제목과 굵게가 그대로 보이고, 복사해서 메모장이나 게시판에 붙이면 표시만 빠집니다.', [
      'Paste an answer from ChatGPT, Claude or Grok and tap once: the Markdown asterisks and hash marks disappear and broken tables are rebuilt, ready to copy straight into Excel. On screen, headings and bold stay as they are, and when you copy and paste into a notepad or message board only the markup is left out.',
      'ChatGPT・Claude・Grokの回答を貼り付けてワンタップするだけで、Markdownの「*」や「#」が取り除かれ、崩れた表も元に戻り、そのままExcelにコピーできます。画面では見出しや太字がそのまま表示され、コピーしてメモ帳や掲示板に貼り付けると記号だけが消えます。',
      '粘贴 ChatGPT、Claude、Grok 给出的回答，轻点一下，Markdown 的星号和井号就会消失，错乱的表格重新排好，可直接复制到 Excel。屏幕上标题和加粗保持原样，复制到记事本或论坛时只会去掉标记符号。',
      '貼上 ChatGPT、Claude、Grok 給出的回答，輕點一下，Markdown 的星號與井號就會消失，錯亂的表格重新排好，可直接複製到 Excel。畫面上標題與粗體維持原樣，複製到記事本或論壇時只會去掉標記符號。',
      'Pega una respuesta de ChatGPT, Claude o Grok y pulsa una vez: desaparecen los asteriscos y almohadillas de Markdown, las tablas rotas se recomponen y puedes copiarlas directamente a Excel. En pantalla se conservan los títulos y las negritas, y al copiar y pegar en un bloc de notas o un foro solo se pierde el marcado.',
      'Collez une réponse de ChatGPT, Claude ou Grok et touchez une fois : les astérisques et dièses du Markdown disparaissent, les tableaux cassés se reconstruisent et se copient directement dans Excel. À l’écran, titres et gras restent intacts ; copiés dans un bloc-notes ou un forum, seuls les symboles disparaissent.',
      'Antwort von ChatGPT, Claude oder Grok einfügen und einmal tippen: Die Markdown-Sternchen und Rauten verschwinden, kaputte Tabellen werden wieder sauber und lassen sich direkt in Excel kopieren. Auf dem Bildschirm bleiben Überschriften und Fettdruck erhalten; beim Einfügen in Editor oder Forum fallen nur die Auszeichnungen weg.',
      'Cole uma resposta do ChatGPT, Claude ou Grok e toque uma vez: os asteriscos e hashtags do Markdown somem, as tabelas quebradas são refeitas e já podem ser copiadas para o Excel. Na tela, títulos e negritos continuam visíveis, e ao copiar para o bloco de notas ou um fórum só a marcação fica de fora.',
      'Dán câu trả lời từ ChatGPT, Claude hay Grok rồi chạm một lần: dấu sao và dấu thăng của Markdown biến mất, bảng bị vỡ được dựng lại và có thể sao chép thẳng vào Excel. Trên màn hình, tiêu đề và chữ đậm vẫn giữ nguyên; khi sao chép sang Notepad hay diễn đàn, chỉ phần ký hiệu bị loại bỏ.',
      'Incolla una risposta di ChatGPT, Claude o Grok e tocca una volta: asterischi e cancelletti del Markdown spariscono e le tabelle rotte vengono ricostruite, pronte da copiare direttamente in Excel. Sullo schermo titoli e grassetto restano com’è, e quando copi e incolli in un blocco note o in un messaggio rimane fuori solo il markup.']],
    ['깨진 표가 다시 선 화면', [
      'Screen where a broken table is rebuilt', '崩れた表が元に戻った画面', '错乱表格重新排好的画面', '錯亂表格重新排好的畫面', 'Pantalla con una tabla rota recompuesta', 'Écran où un tableau cassé est reconstruit',
      'Ansicht mit wiederhergestellter Tabelle', 'Tela com uma tabela quebrada refeita', 'Màn hình bảng bị vỡ được dựng lại', 'Schermata in cui una tabella rotta viene ricostruita']],
    ['표 정리', ['Table cleanup', '表の整理', '整理表格', '整理表格', 'Limpiar tablas', 'Nettoyage de tableaux', 'Tabellen aufräumen', 'Organizar tabelas', 'Dọn bảng', 'Pulizia delle tabelle']],
    ['메모 목록 화면', ['Note list screen', 'メモ一覧画面', '备忘列表画面', '備忘清單畫面', 'Pantalla de lista de notas', 'Écran de la liste de notes', 'Notizliste', 'Tela da lista de notas', 'Màn hình danh sách ghi chú', 'Schermata dell’elenco note']],
    ['메모 목록', ['Note list', 'メモ一覧', '备忘列表', '備忘清單', 'Lista de notas', 'Liste de notes', 'Notizliste', 'Lista de notas', 'Danh sách ghi chú', 'Elenco note']],
    ['고친 자취를 되돌리는 화면', [
      'Screen for undoing edits', '修正の履歴を元に戻す画面', '撤销修改记录的画面', '還原修改記錄的畫面', 'Pantalla para deshacer los cambios', 'Écran pour annuler les modifications',
      'Ansicht zum Rückgängigmachen von Änderungen', 'Tela para desfazer as alterações', 'Màn hình hoàn tác các chỉnh sửa', 'Schermata per annullare le modifiche']],
    ['되돌리기', ['Undo', '元に戻す', '撤销', '還原', 'Deshacer', 'Annuler', 'Rückgängig', 'Desfazer', 'Hoàn tác', 'Annulla']],
    ['안드로이드폰에서 연 Skyblue Note', [
      'Skyblue Note open on an Android phone', 'AndroidスマホでSkyblue Noteを開いた画面', '在安卓手机上打开的 Skyblue Note', '在 Android 手機上開啟的 Skyblue Note', 'Skyblue Note abierta en un teléfono Android', 'Skyblue Note ouverte sur un téléphone Android',
      'Skyblue Note auf einem Android-Handy', 'Skyblue Note aberto em um celular Android', 'Skyblue Note mở trên điện thoại Android', 'Skyblue Note aperta su un telefono Android']],
    ['안드로이드', ['Android', 'Android', '安卓', 'Android', 'Android', 'Android', 'Android', 'Android', 'Android', 'Android']],
    ['맥 앱에서 연 Skyblue Note', [
      'Skyblue Note open in the Mac app', 'MacアプリでSkyblue Noteを開いた画面', '在 Mac 应用中打开的 Skyblue Note', '在 Mac App 中開啟的 Skyblue Note', 'Skyblue Note abierta en la app para Mac', 'Skyblue Note ouverte dans l’app Mac',
      'Skyblue Note in der Mac-App', 'Skyblue Note aberto no app para Mac', 'Skyblue Note mở trong ứng dụng Mac', 'Skyblue Note aperta nell’app per Mac']],
    ['맥', ['Mac', 'Mac', 'Mac', 'Mac', 'Mac', 'Mac', 'Mac', 'Mac', 'Mac', 'Mac']],
    ['브라우저에서 연 Skyblue Note', [
      'Skyblue Note open in a browser', 'ブラウザでSkyblue Noteを開いた画面', '在浏览器中打开的 Skyblue Note', '在瀏覽器中開啟的 Skyblue Note', 'Skyblue Note abierta en el navegador', 'Skyblue Note ouverte dans un navigateur',
      'Skyblue Note im Browser', 'Skyblue Note aberto no navegador', 'Skyblue Note mở trên trình duyệt', 'Skyblue Note aperta in un browser']],
    ['브라우저', ['Browser', 'ブラウザ', '浏览器', '瀏覽器', 'Navegador', 'Navigateur', 'Browser', 'Navegador', 'Trình duyệt', 'Browser']],
    ['빠른 정리기', ['Quick cleaner', 'クイック整理ツール', '快速整理器', '快速整理器', 'Limpiador rápido', 'Nettoyeur rapide', 'Schnellbereiniger', 'Organizador rápido', 'Dọn nhanh', 'Pulizia rapida']],
    ['준비 중', ['coming soon', '準備中', '准备中', '準備中', 'próximamente', 'bientôt', 'in Vorbereitung', 'em preparação', 'sắp ra mắt', 'in arrivo']],
    ['충전 · 시계', ['Charging · Clock', '充電 · 時計', '充电 · 时钟', '充電 · 時鐘', 'Carga · Reloj', 'Recharge · Horloge', 'Laden · Uhr', 'Carregamento · Relógio', 'Sạc · Đồng hồ', 'Ricarica · Orologio']],
    ['배터리 라이프', ['Battery Life', 'Battery Life', 'Battery Life', 'Battery Life', 'Battery Life', 'Battery Life', 'Battery Life', 'Battery Life', 'Battery Life', 'Battery Life']],
    ['배터리 라이프 소개 보기', [
      'See about Battery Life', 'Battery Lifeの紹介を見る', '查看 Battery Life 介绍', '查看 Battery Life 介紹', 'Ver información de Battery Life', 'Découvrir Battery Life',
      'Mehr über Battery Life', 'Conhecer o Battery Life', 'Xem giới thiệu Battery Life', 'Scopri Battery Life']],
    ['충전기를 꽂아 두는 동안 켜 두고 보는 앱입니다. 지금 들어오는 충전 속도를 와트로 크게 보여 주고, 완충까지 남은 시간은 80%를 넘으면 느려지는 구간까지 넣어 계산합니다. 큼직한 플립시계와 날씨, 잔잔한 음악, 기상 알람이 함께 있어 머리맡에 세워 두기 좋습니다.', [
      'An app to leave on while your phone charges. It shows the current charging speed in big watt numbers, and estimates the time to full charge including the slowdown after 80%. With a large flip clock, weather, soft music and a wake-up alarm, it is perfect to stand by your bedside.',
      '充電中につけっぱなしにして見るアプリです。今の充電速度をワット数で大きく表示し、満充電までの残り時間は80%を超えると遅くなる区間まで含めて計算します。大きなフリップ時計、天気、穏やかな音楽、目覚ましアラームもそろっていて、枕元に立てておくのにぴったりです。',
      '这是一款充电时开着看的应用。以大号瓦数显示当前充电速度，并把超过 80% 后变慢的阶段也算进去，估算充满所需时间。配有大号翻页时钟、天气、舒缓音乐和起床闹钟，立在床头再合适不过。',
      '這是一款充電時開著看的 App。以大字瓦數顯示目前充電速度，並把超過 80% 後變慢的階段也算進去，估算充滿所需時間。附有大型翻頁時鐘、天氣、舒緩音樂與起床鬧鐘，立在床頭再適合不過。',
      'Una app para dejar encendida mientras el móvil se carga. Muestra en grande la velocidad de carga actual en vatios y calcula el tiempo hasta la carga completa teniendo en cuenta la ralentización a partir del 80 %. Con un gran reloj de paletas, el tiempo, música suave y alarma de despertador, es ideal para la mesilla de noche.',
      'Une app à laisser allumée pendant la recharge. Elle affiche en grand la vitesse de recharge actuelle en watts et estime le temps restant jusqu’à la charge complète en tenant compte du ralentissement après 80 %. Avec une grande horloge à palettes, la météo, une musique douce et un réveil, elle trouve sa place sur la table de chevet.',
      'Eine App, die beim Laden eingeschaltet bleibt. Sie zeigt die aktuelle Ladegeschwindigkeit groß in Watt und berechnet die Restzeit bis zur vollen Ladung inklusive der Verlangsamung ab 80 %. Mit großer Flipuhr, Wetter, ruhiger Musik und Weckalarm eignet sie sich bestens fürs Nachttischchen.',
      'Um app para deixar ligado enquanto o celular carrega. Mostra em destaque a velocidade de carregamento atual em watts e calcula o tempo até a carga completa incluindo a desaceleração após 80%. Com um grande relógio de pás, clima, música suave e alarme de despertar, é ótimo para deixar na cabeceira.',
      'Ứng dụng để bật sáng trong lúc điện thoại đang sạc. Hiển thị cỡ lớn tốc độ sạc hiện tại theo watt và tính thời gian còn lại đến khi đầy, kể cả đoạn sạc chậm lại sau 80%. Có đồng hồ lật cỡ lớn, thời tiết, nhạc nhẹ và báo thức, rất hợp để đặt đầu giường.',
      'Un’app da lasciare accesa mentre il telefono si ricarica. Mostra la velocità di ricarica attuale in grandi numeri in watt e stima il tempo per arrivare al 100%, compreso il rallentamento dopo l’80%. Con un grande orologio flip, meteo, musica soft e sveglia, è perfetta da tenere sul comodino.']],
    ['충전 속도와 완충까지 남은 시간이 보이는 첫 화면', [
      'Home screen showing charging speed and time to full charge', '充電速度と満充電までの残り時間が見えるトップ画面', '显示充电速度与充满剩余时间的首页', '顯示充電速度與充滿剩餘時間的首頁', 'Pantalla de inicio con la velocidad de carga y el tiempo hasta la carga completa', 'Écran d’accueil avec la vitesse de recharge et le temps restant avant la charge complète',
      'Startseite mit Ladegeschwindigkeit und Restzeit bis zur vollen Ladung', 'Tela inicial com a velocidade de carregamento e o tempo até a carga completa', 'Màn hình chính hiển thị tốc độ sạc và thời gian còn lại đến khi đầy', 'Schermata Home con velocità di ricarica e tempo al 100%']],
    ['충전 속도', ['Charging speed', '充電速度', '充电速度', '充電速度', 'Velocidad de carga', 'Vitesse de recharge', 'Ladegeschwindigkeit', 'Velocidade de carregamento', 'Tốc độ sạc', 'Velocità di ricarica']],
    ['충전 속도를 와트와 등급으로 보여 주는 화면', [
      'Screen showing charging speed in watts and as a grade', '充電速度をワット数とランクで表示する画面', '以瓦数和等级显示充电速度的画面', '以瓦數與等級顯示充電速度的畫面', 'Pantalla que muestra la velocidad de carga en vatios y con una calificación', 'Écran affichant la vitesse de recharge en watts et en niveau',
      'Ansicht mit Ladegeschwindigkeit in Watt und Einstufung', 'Tela com a velocidade de carregamento em watts e em nível', 'Màn hình hiển thị tốc độ sạc theo watt và xếp hạng', 'Schermata con la velocità di ricarica in watt e in classi']],
    ['숫자로 보기', ['See the numbers', '数字で見る', '用数字查看', '用數字查看', 'Ver en cifras', 'Voir en chiffres', 'In Zahlen sehen', 'Ver em números', 'Xem bằng con số', 'Guarda i numeri']],
    ['80% 이후 느려지는 이유를 설명하는 화면', [
      'Screen explaining why charging slows after 80%', '80%を超えると遅くなる理由を説明する画面', '说明超过 80% 后变慢原因的画面', '說明超過 80% 後變慢原因的畫面', 'Pantalla que explica por qué la carga se ralentiza tras el 80 %', 'Écran expliquant pourquoi la recharge ralentit après 80 %',
      'Ansicht, die erklärt, warum das Laden ab 80 % langsamer wird', 'Tela que explica por que o carregamento fica mais lento após 80%', 'Màn hình giải thích vì sao sạc chậm lại sau 80%', 'Schermata che spiega perché la ricarica rallenta dopo l’80%']],
    ['80% 이후', ['After 80%', '80%以降', '80% 之后', '80% 之後', 'Tras el 80 %', 'Après 80 %', 'Nach 80 %', 'Após 80%', 'Sau 80%', 'Dopo l’80%']],
    ['플립시계와 날씨, 음악이 함께 있는 화면', [
      'Screen with a flip clock, weather and music', 'フリップ時計と天気、音楽がそろった画面', '同时有翻页时钟、天气和音乐的画面', '同時有翻頁時鐘、天氣與音樂的畫面', 'Pantalla con reloj de paletas, tiempo y música', 'Écran avec horloge à palettes, météo et musique',
      'Ansicht mit Flipuhr, Wetter und Musik', 'Tela com relógio de pás, clima e música', 'Màn hình có đồng hồ lật, thời tiết và nhạc', 'Schermata con orologio flip, meteo e musica']],
    ['시계 · 날씨 · 음악', ['Clock · Weather · Music', '時計 · 天気 · 音楽', '时钟 · 天气 · 音乐', '時鐘 · 天氣 · 音樂', 'Reloj · Tiempo · Música', 'Horloge · Météo · Musique', 'Uhr · Wetter · Musik', 'Relógio · Clima · Música', 'Đồng hồ · Thời tiết · Nhạc', 'Orologio · Meteo · Musica']],
    ['밤에 어둡게 바뀐 화면', [
      'Screen dimmed for the night', '夜に暗くなった画面', '夜间自动变暗的画面', '夜間自動變暗的畫面', 'Pantalla atenuada por la noche', 'Écran assombri la nuit',
      'Ansicht, die nachts abdunkelt', 'Tela escurecida à noite', 'Màn hình tối đi vào ban đêm', 'Schermata oscurata per la notte']],
    ['밤에는 조용히', ['Quiet at night', '夜は静かに', '夜晚安静下来', '夜晚安靜下來', 'Tranquila por la noche', 'Discrète la nuit', 'Nachts ganz leise', 'Silencioso à noite', 'Yên tĩnh về đêm', 'Silenziosa di notte']],
    ['무료', ['Free', '無料', '免费', '免費', 'Gratis', 'Gratuit', 'Kostenlos', 'Grátis', 'Miễn phí', 'Gratis']],
    ['사진 · 액자', ['Photos · Frame', '写真 · フォトフレーム', '照片 · 相框', '照片 · 相框', 'Fotos · Marco', 'Photos · Cadre', 'Fotos · Bilderrahmen', 'Fotos · Porta-retratos', 'Ảnh · Khung ảnh', 'Foto · Cornice']],
    ['포토 타임', ['Photo Time', 'Photo Time', 'Photo Time', 'Photo Time', 'Photo Time', 'Photo Time', 'Photo Time', 'Photo Time', 'Photo Time', 'Photo Time']],
    ['포토 타임 소개 보기', [
      'See about Photo Time', 'Photo Timeの紹介を見る', '查看 Photo Time 介绍', '查看 Photo Time 介紹', 'Ver información de Photo Time', 'Découvrir Photo Time',
      'Mehr über Photo Time', 'Conhecer o Photo Time', 'Xem giới thiệu Photo Time', 'Scopri Photo Time']],
    ['사진첩의 사진을 배경 음악과 함께 여러 방식의 슬라이드쇼로 보여 줍니다. 폴라로이드, 옛날 사진, 매트 액자처럼 벽에 붙인 인화 사진 모양으로 한 장씩, 가끔은 작은 콜라주로 넘어가고, 위에는 큼직한 플립시계와 오늘 날씨가 떠 있습니다. 사진은 기기 밖으로 나가지 않습니다. 서랍 속 옛 아이패드를 사진 액자로 되살리기 좋습니다.', [
      'Plays the photos in your library as slideshows in several styles, with background music. Photos appear one at a time as prints on a wall — Polaroids, vintage snapshots, matted frames — and now and then as a small collage, with a large flip clock and today’s weather on top. Your photos never leave the device. A great way to turn an old iPad from the drawer into a photo frame.',
      'フォトライブラリの写真を、BGMと一緒にさまざまなスタイルのスライドショーで見せます。ポラロイド、昔の写真、マット額装など壁に飾った写真のように一枚ずつ、ときどき小さなコラージュで切り替わり、上には大きなフリップ時計と今日の天気が表示されます。写真が端末の外に出ることはありません。引き出しに眠る古いiPadをフォトフレームとして蘇らせるのにぴったりです。',
      '把相册里的照片配上背景音乐，以多种方式做成幻灯片播放。像贴在墙上的洗印照片那样——拍立得、老照片、卡纸相框——一张张切换，偶尔变成小拼贴，顶部是大号翻页时钟和今日天气。照片不会离开设备。把抽屉里的旧 iPad 变身相框再合适不过。',
      '把相簿裡的照片配上背景音樂，以多種方式做成幻燈片播放。像貼在牆上的沖洗照片那樣——拍立得、老照片、卡紙相框——一張張切換，偶爾變成小拼貼，頂部是大型翻頁時鐘與今日天氣。照片不會離開裝置。把抽屜裡的舊 iPad 變身相框再適合不過。',
      'Muestra las fotos de tu carrete como presentaciones en varios estilos, con música de fondo. Aparecen una a una como copias colgadas en la pared —Polaroid, fotos antiguas, marcos con paspartú— y de vez en cuando en un pequeño collage, con un gran reloj de paletas y el tiempo de hoy encima. Las fotos no salen del dispositivo. Ideal para dar nueva vida a un iPad antiguo olvidado en un cajón.',
      'Affiche les photos de votre photothèque en diaporamas de plusieurs styles, avec une musique de fond. Elles défilent une à une comme des tirages accrochés au mur — Polaroid, photos anciennes, cadres avec passe-partout — et parfois en petit collage, avec en haut une grande horloge à palettes et la météo du jour. Vos photos ne quittent jamais l’appareil. Idéal pour redonner vie à un vieil iPad oublié dans un tiroir.',
      'Zeigt die Fotos Ihrer Mediathek mit Hintergrundmusik als Diashow in mehreren Stilen. Sie erscheinen einzeln wie Abzüge an der Wand – Polaroid, Vintage-Foto, Passepartout-Rahmen –, hin und wieder als kleine Collage, darüber eine große Flipuhr und das heutige Wetter. Die Fotos verlassen nie das Gerät. Ideal, um ein altes iPad aus der Schublade als Bilderrahmen wiederzubeleben.',
      'Exibe as fotos da sua galeria em apresentações de vários estilos, com música de fundo. Elas aparecem uma a uma como cópias penduradas na parede — Polaroid, fotos antigas, molduras com passe-partout — e às vezes em uma pequena colagem, com um grande relógio de pás e o clima de hoje por cima. As fotos não saem do dispositivo. Ótimo para dar nova vida a um iPad antigo esquecido na gaveta.',
      'Trình chiếu ảnh trong thư viện theo nhiều kiểu, kèm nhạc nền. Ảnh hiện từng tấm như ảnh in treo tường — Polaroid, ảnh xưa, khung có viền — thỉnh thoảng chuyển thành bộ ảnh ghép nhỏ, phía trên là đồng hồ lật cỡ lớn và thời tiết hôm nay. Ảnh không rời khỏi thiết bị. Rất hợp để biến chiếc iPad cũ trong ngăn kéo thành khung ảnh.',
      'Riproduce le foto della tua libreria come presentazioni in vari stili, con musica di sottofondo. Le foto compaiono una alla volta come stampe appese a un muro — Polaroid, istantanee vintage, passepartout — e ogni tanto come un piccolo collage, con un grande orologio flip e il meteo di oggi in alto. Le tue foto non lasciano mai il dispositivo. Un ottimo modo per trasformare un vecchio iPad dimenticato nel cassetto in una cornice digitale.']],
    ['플립시계 아래 걸린 사진 한 장', [
      'A single photo hanging below the flip clock', 'フリップ時計の下に飾られた写真1枚', '挂在翻页时钟下方的一张照片', '掛在翻頁時鐘下方的一張照片', 'Una foto colgada bajo el reloj de paletas', 'Une photo accrochée sous l’horloge à palettes',
      'Ein Foto unter der Flipuhr', 'Uma foto pendurada abaixo do relógio de pás', 'Một tấm ảnh treo bên dưới đồng hồ lật', 'Una singola foto appesa sotto l’orologio flip']],
    ['사진 액자', ['Photo frame', 'フォトフレーム', '相框', '相框', 'Marco de fotos', 'Cadre photo', 'Bilderrahmen', 'Porta-retratos', 'Khung ảnh', 'Cornice foto']],
    ['작은 콜라주로 걸린 사진들', [
      'Photos hung as a small collage', '小さなコラージュで飾られた写真', '以小拼贴形式展示的照片', '以小拼貼形式展示的照片', 'Fotos colgadas en un pequeño collage', 'Photos accrochées en petit collage',
      'Fotos als kleine Collage', 'Fotos penduradas em uma pequena colagem', 'Ảnh treo dưới dạng ghép nhỏ', 'Foto appese a formare un piccolo collage']],
    ['콜라주', ['Collage', 'コラージュ', '拼贴', '拼貼', 'Collage', 'Collage', 'Collage', 'Colagem', 'Ảnh ghép', 'Collage']],
    ['액자 모양을 고르는 설정 화면', [
      'Settings screen for choosing the frame style', 'フレームの形を選ぶ設定画面', '选择相框样式的设置画面', '選擇相框樣式的設定畫面', 'Pantalla de ajustes para elegir el estilo del marco', 'Écran de réglages pour choisir le style du cadre',
      'Einstellungen zur Wahl des Rahmenstils', 'Tela de ajustes para escolher o estilo da moldura', 'Màn hình cài đặt chọn kiểu khung', 'Schermata delle impostazioni per scegliere lo stile della cornice']],
    ['액자 고르기', ['Choose a frame', 'フレームを選ぶ', '选择相框', '選擇相框', 'Elegir marco', 'Choisir un cadre', 'Rahmen wählen', 'Escolher moldura', 'Chọn khung', 'Scegli una cornice']],
    ['오래된 아이패드도 · iOS 15부터', [
      'Works on old iPads too · iOS 15 and later', '古いiPadでも · iOS 15以降', '旧款 iPad 也能用 · iOS 15 起', '舊款 iPad 也能用 · iOS 15 起', 'Funciona en iPad antiguos · desde iOS 15', 'Fonctionne aussi sur les vieux iPad · dès iOS 15',
      'Auch auf alten iPads · ab iOS 15', 'Funciona em iPads antigos · a partir do iOS 15', 'Chạy cả trên iPad cũ · từ iOS 15', 'Funziona anche sui vecchi iPad · iOS 15 e successivi']],
    ['사진 · 편집', ['Photos · Editing', '写真 · 編集', '照片 · 编辑', '照片 · 編輯', 'Fotos · Edición', 'Photos · Retouche', 'Fotos · Bearbeitung', 'Fotos · Edição', 'Ảnh · Chỉnh sửa', 'Foto · Modifica']],
    ['(롱롱)', ['(LongLong)', '(ロンロン)', '(LongLong)', '(LongLong)', '(LongLong)', '(LongLong)', '(LongLong)', '(LongLong)', '(LongLong)', '(LongLong)']],
    ['LongLong App Store 보기', [
      'View LongLong on the App Store', 'App StoreでLongLongを見る', '在 App Store 查看 LongLong', '在 App Store 查看 LongLong', 'Ver LongLong en la App Store', 'Voir LongLong sur l’App Store',
      'LongLong im App Store ansehen', 'Ver o LongLong na App Store', 'Xem LongLong trên App Store', 'Vedi LongLong su App Store']],
    ['스크린샷 여러 장을 한 장의 긴 이미지로 자동으로 이어 붙입니다. 겹치는 부분을 알아서 찾아 지우고, 매번 반복되는 상단바와 하단바도 걸러 냅니다. 천천히 내리며 찍은 화면 녹화도 긴 이미지로 바뀌고, 자르기, 구간 지우기, 모자이크, 글자 추출, 긴 이미지 나누기까지 한 앱에서 끝납니다. 사진과 글자 인식은 기기 안에서 처리합니다.', [
      'Automatically stitches several screenshots into one long image. It finds and removes the overlapping parts on its own and filters out the status and navigation bars that repeat in every shot. A screen recording made while scrolling slowly also becomes a long image, and cropping, deleting sections, mosaic, text extraction and splitting a long image are all done in one app. Photos and text recognition are processed on the device.',
      '複数のスクリーンショットを自動で1枚の長い画像につなぎ合わせます。重なっている部分を自動で見つけて取り除き、毎回繰り返されるステータスバーやナビゲーションバーも除外します。ゆっくりスクロールしながら撮った画面録画も長い画像になり、トリミング、区間の削除、モザイク、文字抽出、長い画像の分割まで1つのアプリで完結します。写真と文字認識は端末内で処理します。',
      '自动将多张截图拼接成一张长图。自动找出并删除重叠部分，也会过滤每张都重复出现的状态栏和导航栏。缓慢滚动时录制的屏幕录像同样能变成长图，裁剪、删除片段、马赛克、提取文字、拆分长图，一个应用全部搞定。照片与文字识别都在设备内处理。',
      '自動將多張截圖拼接成一張長圖。自動找出並刪除重疊部分，也會過濾每張都重複出現的狀態列與導覽列。緩慢捲動時錄製的螢幕錄影同樣能變成長圖，裁切、刪除片段、馬賽克、擷取文字、拆分長圖，一個 App 全部搞定。照片與文字辨識都在裝置內處理。',
      'Une varias capturas de pantalla en una sola imagen larga de forma automática. Encuentra y elimina por sí sola las zonas que se repiten y filtra las barras superior e inferior que aparecen en cada captura. Una grabación de pantalla hecha desplazándote despacio también se convierte en una imagen larga, y recortar, borrar tramos, pixelar, extraer texto y dividir la imagen larga se hace en una sola app. Las fotos y el reconocimiento de texto se procesan en el dispositivo.',
      'Assemble automatiquement plusieurs captures d’écran en une seule longue image. Elle repère et supprime d’elle-même les zones qui se chevauchent et écarte les barres du haut et du bas qui se répètent à chaque capture. Un enregistrement d’écran fait en défilant lentement devient aussi une longue image, et recadrage, suppression de passages, mosaïque, extraction de texte et découpe de la longue image se font dans une seule app. Photos et reconnaissance de texte sont traitées sur l’appareil.',
      'Fügt mehrere Screenshots automatisch zu einem langen Bild zusammen. Überlappende Bereiche werden von selbst erkannt und entfernt, ebenso die in jeder Aufnahme wiederkehrenden oberen und unteren Leisten. Auch eine langsam scrollend aufgenommene Bildschirmaufnahme wird zum langen Bild, und Zuschneiden, Abschnitte löschen, Mosaik, Text extrahieren und das Teilen langer Bilder erledigen Sie in einer App. Fotos und Texterkennung werden auf dem Gerät verarbeitet.',
      'Une automaticamente várias capturas de tela em uma única imagem longa. Encontra e remove sozinho as partes sobrepostas e filtra as barras superior e inferior que se repetem em cada captura. Uma gravação de tela feita rolando devagar também vira uma imagem longa, e cortar, apagar trechos, aplicar mosaico, extrair texto e dividir a imagem longa se resolve em um só app. Fotos e reconhecimento de texto são processados no dispositivo.',
      'Tự động ghép nhiều ảnh chụp màn hình thành một ảnh dài. Tự tìm và xóa phần chồng lặp, đồng thời loại bỏ thanh trạng thái và thanh điều hướng lặp lại ở mỗi ảnh. Video quay màn hình khi cuộn chậm cũng thành ảnh dài, và cắt, xóa đoạn, làm mờ mosaic, trích xuất chữ, chia nhỏ ảnh dài đều xong trong một ứng dụng. Ảnh và nhận dạng chữ được xử lý ngay trên thiết bị.',
      'Unisce automaticamente più screenshot in un’unica immagine lunga. Trova e rimuove da solo le parti sovrapposte e filtra le barre di stato e di navigazione che si ripetono in ogni scatto. Anche una registrazione dello schermo fatta scorrendo lentamente diventa un’immagine lunga, e ritaglio, eliminazione di sezioni, mosaico, estrazione del testo e divisione di un’immagine lunga si fanno tutti in una sola app. Foto e riconoscimento del testo vengono elaborati sul dispositivo.']],
    ['이어 붙일 사진을 자동으로 찾아 주는 화면', [
      'Screen that finds the photos to stitch automatically', 'つなぐ写真を自動で探してくれる画面', '自动找出待拼接照片的画面', '自動找出待拼接照片的畫面', 'Pantalla que encuentra automáticamente las fotos que unir', 'Écran qui trouve automatiquement les photos à assembler',
      'Ansicht, die die zu verbindenden Fotos automatisch findet', 'Tela que encontra automaticamente as fotos a unir', 'Màn hình tự tìm ảnh cần ghép', 'Schermata che trova automaticamente le foto da unire']],
    ['자동으로 찾기', ['Auto-detect', '自動で探す', '自动查找', '自動尋找', 'Búsqueda automática', 'Détection automatique', 'Automatisch finden', 'Busca automática', 'Tự động tìm', 'Rilevamento automatico']],
    ['이어 붙인 경계를 다듬는 편집 화면', [
      'Editing screen for refining the stitched seams', 'つなぎ目を整える編集画面', '修整拼接处的编辑画面', '修整拼接處的編輯畫面', 'Pantalla de edición para pulir las uniones', 'Écran de retouche pour affiner les raccords',
      'Bearbeitungsansicht zum Feinschliff der Nahtstellen', 'Tela de edição para ajustar as emendas', 'Màn hình chỉnh sửa đường ghép', 'Schermata di modifica per rifinire i punti di unione']],
    ['정밀 편집', ['Precise editing', '精密編集', '精细编辑', '精細編輯', 'Edición precisa', 'Retouche précise', 'Feinbearbeitung', 'Edição precisa', 'Chỉnh sửa chi tiết', 'Modifica di precisione']],
    ['이미지에서 글자를 뽑아 복사하는 화면', [
      'Screen for extracting and copying text from an image', '画像から文字を抽出してコピーする画面', '从图片中提取并复制文字的画面', '從圖片中擷取並複製文字的畫面', 'Pantalla para extraer y copiar texto de una imagen', 'Écran pour extraire et copier le texte d’une image',
      'Ansicht zum Extrahieren und Kopieren von Text aus einem Bild', 'Tela para extrair e copiar texto de uma imagem', 'Màn hình trích xuất và sao chép chữ từ ảnh', 'Schermata per estrarre e copiare il testo da un’immagine']],
    ['글자 추출', ['Text extraction', '文字抽出', '提取文字', '擷取文字', 'Extraer texto', 'Extraction de texte', 'Text extrahieren', 'Extrair texto', 'Trích xuất chữ', 'Estrazione del testo']],
    ['긴 이미지에서 한 구간을 지우는 화면', [
      'Screen for deleting a section of a long image', '長い画像の一区間を削除する画面', '删除长图中某一段的画面', '刪除長圖中某一段的畫面', 'Pantalla para borrar un tramo de una imagen larga', 'Écran pour supprimer un passage d’une longue image',
      'Ansicht zum Löschen eines Abschnitts aus einem langen Bild', 'Tela para apagar um trecho de uma imagem longa', 'Màn hình xóa một đoạn của ảnh dài', 'Schermata per eliminare una sezione di un’immagine lunga']],
    ['구간 지우기', ['Delete a section', '区間を削除', '删除片段', '刪除片段', 'Borrar un tramo', 'Supprimer un passage', 'Abschnitt löschen', 'Apagar um trecho', 'Xóa đoạn', 'Elimina una sezione']],
    ['가릴 곳에 모자이크를 거는 화면', [
      'Screen for applying a mosaic to hide an area', '隠したい部分にモザイクをかける画面', '给需要遮挡处打马赛克的画面', '為需要遮擋處打馬賽克的畫面', 'Pantalla para pixelar la zona que quieres ocultar', 'Écran pour appliquer une mosaïque sur une zone à masquer',
      'Ansicht, um einen Bereich mit Mosaik zu verdecken', 'Tela para aplicar mosaico na área a esconder', 'Màn hình làm mờ mosaic vùng cần che', 'Schermata per applicare un mosaico e nascondere un’area']],
    ['모자이크', ['Mosaic', 'モザイク', '马赛克', '馬賽克', 'Pixelado', 'Mosaïque', 'Mosaik', 'Mosaico', 'Mosaic', 'Mosaico']],
    ['개발 중', ['in development', '開発中', '开发中', '開發中', 'en desarrollo', 'en développement', 'in Entwicklung', 'em desenvolvimento', 'đang phát triển', 'in sviluppo']],
    ['문서 · PDF', ['Documents · PDF', '書類 · PDF', '文档 · PDF', '文件 · PDF', 'Documentos · PDF', 'Documents · PDF', 'Dokumente · PDF', 'Documentos · PDF', 'Tài liệu · PDF', 'Documenti · PDF']],
    ['Any to PDF 웹에서 열기', ['Open Any to PDF on the web', 'Any to PDFをWebで開く', '在网页上打开 Any to PDF', '在網頁上開啟 Any to PDF', 'Abrir Any to PDF en la web', 'Ouvrir Any to PDF sur le web', 'Any to PDF im Web öffnen', 'Abrir o Any to PDF na web', 'Mở Any to PDF trên web', 'Apri Any to PDF sul web']],
    ['사진, 글, PDF, 문서 파일을 골라 한 개의 PDF로 만듭니다. 아이폰에서는 브라우저 공유 메뉴의 「PDF로 저장」으로, 보던 웹 페이지를 A4 또는 길게 한 장짜리 PDF로 저장합니다. 사진 여러 장을 한 파일로 묶고, 붙여넣은 글도 바로 PDF가 됩니다. 파일은 서버에 올리지 않고 기기 안에서 만듭니다.', [
      'Pick photos, text, PDFs or document files and turn them into a single PDF. On iPhone, use “Save as PDF” in the browser’s share menu to save the web page you are viewing as A4 or as one long PDF page. Bundle several photos into one file, and pasted text becomes a PDF right away. Files are made on your device and never uploaded to a server.',
      '写真、文章、PDF、書類ファイルを選んで1つのPDFにします。iPhoneではブラウザの共有メニューにある「PDFで保存」で、見ているWebページをA4サイズ、または縦に長い1枚のPDFとして保存できます。複数の写真を1つのファイルにまとめたり、貼り付けた文章をそのままPDFにしたりもできます。ファイルはサーバーにアップロードせず、端末内で作成します。',
      '选择照片、文字、PDF 或文档文件，合成一个 PDF。在 iPhone 上，通过浏览器分享菜单中的「存储为 PDF」，可把正在浏览的网页保存为 A4 或一张长页 PDF。多张照片能合并为一个文件，粘贴的文字也能直接变成 PDF。文件不会上传服务器，全部在设备内生成。',
      '選擇照片、文字、PDF 或文件檔案，合成一個 PDF。在 iPhone 上，透過瀏覽器分享選單中的「儲存為 PDF」，可把正在瀏覽的網頁儲存為 A4 或一張長頁 PDF。多張照片能合併為一個檔案，貼上的文字也能直接變成 PDF。檔案不會上傳伺服器，全部在裝置內產生。',
      'Elige fotos, texto, PDF o documentos y conviértelos en un único PDF. En el iPhone, con «Guardar como PDF» del menú compartir del navegador guardas la página web que estás viendo en A4 o como un PDF largo de una sola página. Reúne varias fotos en un archivo, y el texto pegado se convierte en PDF al instante. Los archivos se crean en tu dispositivo, sin subirlos a ningún servidor.',
      'Choisissez des photos, du texte, des PDF ou des documents et réunissez-les en un seul PDF. Sur iPhone, « Enregistrer en PDF » dans le menu de partage du navigateur enregistre la page web consultée en A4 ou en un seul long PDF. Regroupez plusieurs photos dans un fichier ; un texte collé devient aussitôt un PDF. Les fichiers sont créés sur l’appareil, sans envoi vers un serveur.',
      'Fotos, Text, PDFs oder Dokumente auswählen und zu einem einzigen PDF machen. Auf dem iPhone speichern Sie mit „Als PDF sichern“ im Teilen-Menü des Browsers die aktuelle Webseite als A4-PDF oder als eine lange PDF-Seite. Mehrere Fotos lassen sich zu einer Datei bündeln, und eingefügter Text wird sofort zum PDF. Die Dateien entstehen auf dem Gerät und werden nicht auf einen Server hochgeladen.',
      'Escolha fotos, textos, PDFs ou documentos e transforme em um único PDF. No iPhone, use “Salvar como PDF” no menu de compartilhamento do navegador para salvar a página que você está vendo em A4 ou como um PDF longo de uma página só. Junte várias fotos em um arquivo, e o texto colado vira PDF na hora. Os arquivos são criados no dispositivo, sem envio a servidores.',
      'Chọn ảnh, văn bản, PDF hoặc tệp tài liệu để tạo thành một tệp PDF duy nhất. Trên iPhone, dùng mục “Lưu thành PDF” trong menu chia sẻ của trình duyệt để lưu trang web đang xem thành PDF khổ A4 hoặc một trang PDF dài. Gộp nhiều ảnh vào một tệp, và văn bản dán vào cũng thành PDF ngay. Tệp được tạo ngay trên thiết bị, không tải lên máy chủ.',
      'Scegli foto, testo, PDF o documenti e trasformali in un unico PDF. Su iPhone, usa “Salva come PDF” nel menu di condivisione del browser per salvare la pagina web che stai guardando in formato A4 o come un’unica pagina PDF lunga. Riunisci più foto in un solo file e il testo incollato diventa subito un PDF. I file vengono creati sul tuo dispositivo e non vengono mai caricati su un server.']],
    ['사진, 파일, 웹 주소, 글, PDF 번역을 고르는 첫 화면', [
      'Home screen for choosing photos, files, web addresses, text or PDF translation', '写真、ファイル、Webアドレス、文章、PDF翻訳を選ぶトップ画面', '选择照片、文件、网址、文字、PDF 翻译的首页', '選擇照片、檔案、網址、文字、PDF 翻譯的首頁', 'Pantalla de inicio para elegir fotos, archivos, direcciones web, texto o traducción de PDF', 'Écran d’accueil pour choisir photos, fichiers, adresses web, texte ou traduction de PDF',
      'Startseite zur Wahl von Fotos, Dateien, Webadressen, Text oder PDF-Übersetzung', 'Tela inicial para escolher fotos, arquivos, endereços web, texto ou tradução de PDF', 'Màn hình chính để chọn ảnh, tệp, địa chỉ web, văn bản hoặc dịch PDF', 'Schermata Home per scegliere foto, file, indirizzi web, testo o traduzione PDF']],
    ['웹에서 열기', ['Open on the web', 'Webで開く', '在网页上打开', '在網頁上開啟', 'Abrir en la web', 'Ouvrir sur le web', 'Im Web öffnen', 'Abrir na web', 'Mở trên web', 'Apri sul web']],
    ['무료 · 구독 있음', ['Free · subscription available', '無料 · サブスクあり', '免费 · 提供订阅', '免費 · 提供訂閱', 'Gratis · con suscripción', 'Gratuit · abonnement disponible', 'Kostenlos · Abo verfügbar', 'Grátis · com assinatura', 'Miễn phí · có gói đăng ký', 'Gratis · abbonamento disponibile']],
    ['파일 · 변환', ['Files · Conversion', 'ファイル · 変換', '文件 · 转换', '檔案 · 轉換', 'Archivos · Conversión', 'Fichiers · Conversion', 'Dateien · Konvertierung', 'Arquivos · Conversão', 'Tệp · Chuyển đổi', 'File · Conversione']],
    ['Ez Converter 웹에서 열기', ['Open Ez Converter on the web', 'Ez ConverterをWebで開く', '在网页上打开 Ez Converter', '在網頁上開啟 Ez Converter', 'Abrir Ez Converter en la web', 'Ouvrir Ez Converter sur le web', 'Ez Converter im Web öffnen', 'Abrir o Ez Converter na web', 'Mở Ez Converter trên web', 'Apri Ez Converter sul web']],
    ['흔한 파일 형식을 기기 안에서만 바꿉니다. HEIC 사진을 JPG로, MOV 동영상을 MP4로, CSV를 엑셀로 바꾸는 일이 서버에 올리지 않고 끝나서 인터넷이 끊겨도 됩니다. 여러 파일을 한 번에 넣고, 사진·소리·동영상·표·PDF의 바꿀 형식을 한 화면에서 고릅니다. 웹에서는 설치 없이 바로 씁니다.', [
      'Converts common file formats entirely on your device. HEIC photos to JPG, MOV videos to MP4, CSV to Excel — all done without uploading to a server, so it works even offline. Drop in many files at once and pick the output format for photos, audio, video, tables and PDFs on a single screen. On the web, use it right away with no install.',
      'よく使うファイル形式を、端末の中だけで変換します。HEIC写真をJPGに、MOV動画をMP4に、CSVをExcelに。サーバーにアップロードせずに完了するので、インターネットが切れていても使えます。複数のファイルを一度に入れ、写真・音声・動画・表・PDFの変換先を1画面で選べます。Webならインストール不要ですぐ使えます。',
      '常见文件格式只在设备内转换。把 HEIC 照片转成 JPG、MOV 视频转成 MP4、CSV 转成 Excel，全程不上传服务器，断网也能用。可一次放入多个文件，并在同一界面为照片、音频、视频、表格和 PDF 选择目标格式。网页版无需安装，打开即用。',
      '常見檔案格式只在裝置內轉換。把 HEIC 照片轉成 JPG、MOV 影片轉成 MP4、CSV 轉成 Excel，全程不上傳伺服器，斷網也能用。可一次放入多個檔案，並在同一畫面為照片、音訊、影片、表格與 PDF 選擇目標格式。網頁版無需安裝，開啟即用。',
      'Convierte los formatos de archivo más comunes sin salir de tu dispositivo. De HEIC a JPG, de vídeos MOV a MP4, de CSV a Excel: todo sin subir nada a un servidor, así que funciona incluso sin conexión. Añade varios archivos a la vez y elige en una sola pantalla el formato de destino para fotos, audio, vídeo, tablas y PDF. En la web se usa al instante, sin instalar nada.',
      'Convertit les formats de fichiers courants uniquement sur votre appareil. Photos HEIC en JPG, vidéos MOV en MP4, CSV en Excel : tout se fait sans envoi vers un serveur, donc même hors connexion. Déposez plusieurs fichiers à la fois et choisissez sur un seul écran le format de sortie des photos, du son, des vidéos, des tableaux et des PDF. Sur le web, il s’utilise tout de suite, sans installation.',
      'Wandelt gängige Dateiformate ausschließlich auf Ihrem Gerät um. HEIC-Fotos in JPG, MOV-Videos in MP4, CSV in Excel – ohne Upload auf einen Server, daher auch offline nutzbar. Mehrere Dateien auf einmal einfügen und auf einem Bildschirm das Zielformat für Fotos, Audio, Video, Tabellen und PDFs wählen. Im Web sofort nutzbar, ohne Installation.',
      'Converte os formatos de arquivo mais comuns só dentro do seu dispositivo. HEIC para JPG, vídeos MOV para MP4, CSV para Excel: tudo sem enviar a um servidor, então funciona até sem internet. Adicione vários arquivos de uma vez e escolha, em uma só tela, o formato de saída de fotos, áudio, vídeo, tabelas e PDFs. Na web, use na hora, sem instalar.',
      'Chuyển đổi các định dạng tệp phổ biến hoàn toàn trong thiết bị. Ảnh HEIC sang JPG, video MOV sang MP4, CSV sang Excel — tất cả không tải lên máy chủ nên mất mạng vẫn dùng được. Thêm nhiều tệp cùng lúc và chọn định dạng đầu ra cho ảnh, âm thanh, video, bảng và PDF ngay trên một màn hình. Bản web dùng ngay, không cần cài đặt.',
      'Converte i formati di file più comuni interamente sul dispositivo. Foto HEIC in JPG, video MOV in MP4, CSV in Excel — tutto senza caricare nulla su un server, quindi funziona anche offline. Trascina molti file in una volta e scegli il formato di output per foto, audio, video, tabelle e PDF in un’unica schermata. Sul web si usa subito, senza installare nulla.']],
    ['파일과 사진·동영상을 고르는 첫 화면', [
      'Home screen for choosing files, photos and videos', 'ファイルや写真・動画を選ぶトップ画面', '选择文件、照片和视频的首页', '選擇檔案、照片與影片的首頁', 'Pantalla de inicio para elegir archivos, fotos y vídeos', 'Écran d’accueil pour choisir fichiers, photos et vidéos',
      'Startseite zur Auswahl von Dateien, Fotos und Videos', 'Tela inicial para escolher arquivos, fotos e vídeos', 'Màn hình chính để chọn tệp, ảnh và video', 'Schermata Home per scegliere file, foto e video']],
    ['넣은 파일마다 바꿀 형식을 고르는 화면', [
      'Screen for choosing the output format for each file', 'ファイルごとに変換先の形式を選ぶ画面', '为每个文件选择目标格式的画面', '為每個檔案選擇目標格式的畫面', 'Pantalla para elegir el formato de destino de cada archivo', 'Écran pour choisir le format de sortie de chaque fichier',
      'Ansicht zur Wahl des Zielformats je Datei', 'Tela para escolher o formato de saída de cada arquivo', 'Màn hình chọn định dạng đầu ra cho từng tệp', 'Schermata per scegliere il formato di output di ogni file']],
    ['형식 고르기', ['Choose a format', '形式を選ぶ', '选择格式', '選擇格式', 'Elegir formato', 'Choisir un format', 'Format wählen', 'Escolher formato', 'Chọn định dạng', 'Scegli un formato']],
    ['바꾼 파일을 저장하고 공유하는 완료 화면', [
      'Done screen for saving and sharing converted files', '変換したファイルを保存・共有する完了画面', '保存并分享已转换文件的完成画面', '儲存並分享已轉換檔案的完成畫面', 'Pantalla final para guardar y compartir los archivos convertidos', 'Écran final pour enregistrer et partager les fichiers convertis',
      'Abschlussansicht zum Speichern und Teilen der konvertierten Dateien', 'Tela final para salvar e compartilhar os arquivos convertidos', 'Màn hình hoàn tất để lưu và chia sẻ tệp đã chuyển đổi', 'Schermata di completamento per salvare e condividere i file convertiti']],
    ['변환 완료', ['Conversion complete', '変換完了', '转换完成', '轉換完成', 'Conversión completada', 'Conversion terminée', 'Konvertierung abgeschlossen', 'Conversão concluída', 'Chuyển đổi xong', 'Conversione completata']],
    ['PDF 다듬기 세부 설정 화면', [
      'PDF refinement settings screen', 'PDFを整える詳細設定画面', 'PDF 精修详细设置画面', 'PDF 精修詳細設定畫面', 'Pantalla de ajustes detallados para pulir PDF', 'Écran de réglages détaillés pour retoucher un PDF',
      'Detaileinstellungen zum Optimieren von PDFs', 'Tela de ajustes detalhados para refinar PDF', 'Màn hình cài đặt chi tiết để chỉnh PDF', 'Schermata delle impostazioni per rifinire i PDF']],
    ['PDF 다듬기', ['Refine PDFs', 'PDFを整える', '精修 PDF', '精修 PDF', 'Pulir PDF', 'Retoucher un PDF', 'PDF optimieren', 'Refinar PDF', 'Chỉnh PDF', 'Rifinisci i PDF']],
    ['심사 중', ['under review', '審査中', '审核中', '審核中', 'en revisión', 'en cours de validation', 'in Prüfung', 'em análise', 'đang chờ duyệt', 'in revisione']],
    ['업로드 없음 · 무료 · 구독 있음', ['No uploads · Free · subscription available', 'アップロードなし · 無料 · サブスクあり', '无需上传 · 免费 · 提供订阅', '無需上傳 · 免費 · 提供訂閱', 'Sin subidas · Gratis · con suscripción', 'Aucun envoi · Gratuit · abonnement disponible', 'Kein Upload · Kostenlos · Abo verfügbar', 'Sem envio · Grátis · com assinatura', 'Không tải lên · Miễn phí · có gói đăng ký', 'Nessun caricamento · Gratis · abbonamento disponibile']],
    ['문서 · 스캔', ['Documents · Scanning', '書類 · スキャン', '文档 · 扫描', '文件 · 掃描', 'Documentos · Escaneo', 'Documents · Numérisation', 'Dokumente · Scannen', 'Documentos · Digitalização', 'Tài liệu · Quét', 'Documenti · Scansione']],
    ['ezScan 소개 보기', ['See about ezScan', 'ezScanの紹介を見る', '查看 ezScan 介绍', '查看 ezScan 介紹', 'Ver información de ezScan', 'Découvrir ezScan', 'Mehr über ezScan', 'Conhecer o ezScan', 'Xem giới thiệu ezScan', 'Scopri ezScan']],
    ['대고 찍으면 끝나는 문서 스캐너입니다. 쪽을 찾아 배경을 지우고, 말린 책 안쪽과 구부러진 영수증을 펴고, 펼친 두 쪽을 한 쪽씩 나눕니다. 컬러·회색·흑백 보정을 고르고 사진 앱에 저장하거나 PDF로 공유합니다. 모든 처리는 기기 안에서 합니다.', [
      'A document scanner where you just point and shoot. It finds the page and removes the background, flattens the curve of a book near the spine and bent receipts, and splits a two-page spread into single pages. Choose color, grayscale or black-and-white, then save to Photos or share as a PDF. Everything is processed on your device.',
      'かざして撮るだけで完了する書類スキャナーです。ページを見つけて背景を消し、丸まった本の綴じ目付近や曲がったレシートを平らにし、見開き2ページを1ページずつに分けます。カラー・グレー・白黒の補正を選んで、写真アプリに保存したりPDFで共有したりできます。すべての処理は端末内で行います。',
      '对准一拍就完成的文档扫描仪。自动找到纸页并去除背景，抚平书脊附近的弯曲和折皱的收据，并把展开的两页拆成单页。可选彩色、灰度、黑白三种校正，保存到相册或以 PDF 分享。所有处理都在设备内完成。',
      '對準一拍就完成的文件掃描器。自動找到紙頁並去除背景，撫平書脊附近的彎曲與皺折的收據，並把展開的兩頁拆成單頁。可選彩色、灰階、黑白三種校正，儲存到相簿或以 PDF 分享。所有處理都在裝置內完成。',
      'Un escáner de documentos en el que basta apuntar y disparar. Encuentra la página y elimina el fondo, alisa la curva de los libros junto al lomo y los recibos arrugados, y separa una doble página en páginas sueltas. Elige corrección en color, gris o blanco y negro, y guarda en Fotos o comparte como PDF. Todo se procesa en tu dispositivo.',
      'Un scanner de documents où il suffit de viser et de photographier. Il repère la page et supprime l’arrière-plan, aplatit la courbure des livres près de la reliure et les tickets froissés, et sépare une double page en pages simples. Choisissez une correction couleur, gris ou noir et blanc, puis enregistrez dans Photos ou partagez en PDF. Tout est traité sur l’appareil.',
      'Ein Dokumentenscanner, bei dem Draufhalten und Auslösen genügt. Er erkennt die Seite, entfernt den Hintergrund, glättet die Wölbung von Büchern am Falz und geknitterte Kassenbons und trennt eine Doppelseite in Einzelseiten. Wählen Sie Farbe, Graustufen oder Schwarzweiß, speichern Sie in Fotos oder teilen Sie als PDF. Alles wird auf dem Gerät verarbeitet.',
      'Um scanner de documentos em que basta apontar e tirar a foto. Encontra a página e remove o fundo, endireita a curva dos livros perto da lombada e os recibos amassados, e separa uma página dupla em páginas individuais. Escolha correção em cores, cinza ou preto e branco e salve em Fotos ou compartilhe como PDF. Tudo é processado no dispositivo.',
      'Máy quét tài liệu chỉ cần hướng vào và chụp là xong. Tự tìm trang giấy và xóa nền, làm phẳng phần sách cong gần gáy và hóa đơn bị nhàu, đồng thời tách hai trang mở thành từng trang riêng. Chọn chế độ màu, xám hoặc đen trắng rồi lưu vào Ảnh hoặc chia sẻ dưới dạng PDF. Mọi xử lý đều diễn ra trên thiết bị.',
      'Uno scanner di documenti in cui basta inquadrare e scattare. Trova la pagina e rimuove lo sfondo, appiattisce la curvatura di un libro vicino alla rilegatura e gli scontrini piegati, e divide una doppia pagina in pagine singole. Scegli colore, scala di grigi o bianco e nero, poi salva in Foto o condividi come PDF. Tutto viene elaborato sul tuo dispositivo.']],
    ['찍어 둔 문서가 날짜별로 쌓이는 첫 화면', [
      'Home screen where scanned documents pile up by date', '撮影した書類が日付ごとに並ぶトップ画面', '已拍文档按日期排列的首页', '已拍文件按日期排列的首頁', 'Pantalla de inicio donde los documentos escaneados se ordenan por fecha', 'Écran d’accueil où les documents numérisés s’empilent par date',
      'Startseite, auf der gescannte Dokumente nach Datum gestapelt werden', 'Tela inicial em que os documentos digitalizados se acumulam por data', 'Màn hình chính nơi tài liệu đã quét xếp theo ngày', 'Schermata Home dove i documenti scansionati si accumulano per data']],
    ['스캔 목록', ['Scan list', 'スキャン一覧', '扫描列表', '掃描清單', 'Lista de escaneos', 'Liste des numérisations', 'Scanliste', 'Lista de digitalizações', 'Danh sách bản quét', 'Elenco scansioni']],
    ['모든 전자책 뷰어와 파일 번역', [
      'Translate Any eBook Reader or File', 'あらゆる電子書籍ビューアとファイルを翻訳', '翻译任意电子书阅读器与文件', '翻譯任意電子書閱讀器與檔案', 'Traduce cualquier lector de eBooks o archivo', 'Traduisez n’importe quelle liseuse d’eBooks ou fichier',
      'Jeden E-Book-Reader und jede Datei übersetzen', 'Traduza qualquer leitor de eBooks ou arquivo', 'Dịch mọi trình đọc sách điện tử và tệp', 'Traduci qualsiasi lettore di eBook o file']],
    ['Kindle, Apple Books처럼 보던 전자책 뷰어를 그대로 둔 채, 지금 보는 쪽을 옆 창에 번역해 보여 주는 컴퓨터 앱입니다. 원문 쪽의 단 나눔과 제목 크기, 인용 모양을 닮게 그리고, 다음 쪽은 미리 번역해 두어 넘기는 즉시 읽힙니다. PDF와 그림 파일을 열어 왼쪽 원문, 오른쪽 번역으로 볼 수도 있습니다. 기본 번역은 컴퓨터 안에서 돌아 밖으로 나가지 않고, 원하면 내 AI 키로 더 자연스럽게 번역합니다.', [
      'A computer app that leaves the eBook reader you already use, like Kindle or Apple Books, untouched and shows a translation of the page you are reading in a side window. It mirrors the original page’s columns, heading sizes and quote styling, and translates the next page ahead of time so it reads the moment you turn it. You can also open PDFs and image files and view the original on the left and the translation on the right. The default translation runs on your computer and never leaves it, and you can use your own AI key for more natural results.',
      'KindleやApple Booksなど、いつも使っている電子書籍ビューアはそのままに、今開いているページの翻訳を隣のウィンドウに表示するパソコン用アプリです。原文ページの段組み、見出しの大きさ、引用の見た目に似せて表示し、次のページは先に翻訳しておくので、めくった瞬間から読めます。PDFや画像ファイルを開いて、左に原文、右に翻訳を並べて見ることもできます。標準の翻訳はパソコン内で動作して外部に送信されず、お望みなら自分のAIキーでより自然に翻訳できます。',
      '这是一款电脑应用，保留你正在使用的 Kindle、Apple Books 等电子书阅读器不变，把当前页的译文显示在旁边的窗口。译文会还原原文页的分栏、标题大小和引文样式，下一页提前翻译好，翻页即可阅读。也可打开 PDF 和图片文件，左边原文、右边译文对照查看。默认翻译在电脑本地运行，数据不会外传；如有需要，还可使用自己的 AI 密钥获得更自然的译文。',
      '這是一款電腦應用程式，保留你正在使用的 Kindle、Apple Books 等電子書閱讀器不變，把目前頁面的譯文顯示在旁邊的視窗。譯文會還原原文頁的分欄、標題大小與引文樣式，下一頁提前翻譯好，翻頁即可閱讀。也可開啟 PDF 與圖片檔案，左邊原文、右邊譯文對照檢視。預設翻譯在電腦本機執行，資料不會外傳；如有需要，還可使用自己的 AI 金鑰獲得更自然的譯文。',
      'Una app para ordenador que deja intacto el lector de eBooks que ya usas, como Kindle o Apple Books, y muestra la traducción de la página que estás leyendo en una ventana lateral. Reproduce las columnas, el tamaño de los títulos y el estilo de las citas de la página original, y traduce la siguiente página por adelantado para que se lea nada más pasarla. También puedes abrir PDF e imágenes y verlos con el original a la izquierda y la traducción a la derecha. La traducción predeterminada se ejecuta en tu ordenador y no sale de él; si quieres, usa tu propia clave de IA para un resultado más natural.',
      'Une app pour ordinateur qui laisse intacte la liseuse que vous utilisez déjà, comme Kindle ou Apple Books, et affiche la traduction de la page en cours dans une fenêtre voisine. Elle reprend les colonnes, la taille des titres et le style des citations de la page d’origine, et traduit la page suivante à l’avance pour qu’elle soit lisible dès qu’on la tourne. Vous pouvez aussi ouvrir des PDF et des images, avec l’original à gauche et la traduction à droite. La traduction par défaut s’exécute sur votre ordinateur sans rien envoyer à l’extérieur, et vous pouvez utiliser votre propre clé d’IA pour un rendu plus naturel.',
      'Eine Computer-App, die den bereits genutzten E-Book-Reader wie Kindle oder Apple Books unverändert lässt und die Übersetzung der gerade gelesenen Seite in einem Nebenfenster zeigt. Sie bildet Spalten, Überschriftengrößen und Zitatformatierung der Originalseite nach und übersetzt die nächste Seite im Voraus, sodass sie sich beim Umblättern sofort lesen lässt. PDFs und Bilddateien lassen sich ebenfalls öffnen – links das Original, rechts die Übersetzung. Die Standardübersetzung läuft auf Ihrem Computer und verlässt ihn nie; auf Wunsch sorgt Ihr eigener KI-Schlüssel für natürlichere Ergebnisse.',
      'Um app para computador que mantém intacto o leitor de eBooks que você já usa, como Kindle ou Apple Books, e mostra a tradução da página atual em uma janela ao lado. Ela reproduz as colunas, o tamanho dos títulos e o estilo das citações da página original e traduz a próxima página antes, para que ela possa ser lida assim que for virada. Você também pode abrir PDFs e imagens e ver o original à esquerda e a tradução à direita. A tradução padrão roda no seu computador e não sai dele; se quiser, use sua própria chave de IA para um resultado mais natural.',
      'Ứng dụng máy tính giữ nguyên trình đọc sách điện tử bạn đang dùng như Kindle hay Apple Books, đồng thời hiển thị bản dịch của trang đang đọc trong cửa sổ bên cạnh. Bản dịch mô phỏng cách chia cột, cỡ tiêu đề và kiểu trích dẫn của trang gốc, và trang kế tiếp được dịch sẵn nên lật tới là đọc được ngay. Bạn cũng có thể mở tệp PDF và hình ảnh để xem bản gốc bên trái, bản dịch bên phải. Bản dịch mặc định chạy ngay trên máy tính và không gửi ra ngoài; nếu muốn, hãy dùng khóa AI của riêng bạn để dịch tự nhiên hơn.',
      'Un’app per computer che lascia intatto il lettore di eBook che usi già, come Kindle o Apple Books, e mostra la traduzione della pagina che stai leggendo in una finestra laterale. Riproduce le colonne, la dimensione dei titoli e lo stile delle citazioni della pagina originale e traduce in anticipo la pagina successiva, così è pronta appena giri pagina. Puoi anche aprire PDF e file immagine e vedere l’originale a sinistra e la traduzione a destra. La traduzione predefinita funziona sul tuo computer e non ne esce mai, e puoi usare la tua chiave IA per risultati più naturali.']],
    ['왼쪽 영어 원문 쪽과 오른쪽 한국어 번역 쪽이 나란히 보이는 화면(예시 문장)', [
      'Screen showing the English original page on the left and the Korean translation on the right (sample text)', '左に英語の原文ページ、右に韓国語の翻訳ページを並べて表示する画面（例文）', '左侧英文原文页与右侧韩文译文页并排显示的画面（示例文字）', '左側英文原文頁與右側韓文譯文頁並排顯示的畫面（範例文字）', 'Pantalla con la página original en inglés a la izquierda y la traducción al coreano a la derecha (texto de ejemplo)', 'Écran montrant la page originale en anglais à gauche et la traduction en coréen à droite (texte d’exemple)',
      'Ansicht mit englischer Originalseite links und koreanischer Übersetzung rechts (Beispieltext)', 'Tela com a página original em inglês à esquerda e a tradução em coreano à direita (texto de exemplo)', 'Màn hình hiển thị trang gốc tiếng Anh bên trái và bản dịch tiếng Hàn bên phải (câu ví dụ)', 'Schermata con la pagina originale in inglese a sinistra e la traduzione in coreano a destra (testo di esempio)']],
    ['원문과 번역 나란히', ['Original and translation side by side', '原文と翻訳を並べて表示', '原文与译文并排', '原文與譯文並排', 'Original y traducción en paralelo', 'Original et traduction côte à côte', 'Original und Übersetzung nebeneinander', 'Original e tradução lado a lado', 'Bản gốc và bản dịch song song', 'Originale e traduzione affiancati']],
    ['곧 공개', ['coming soon', '近日公開', '即将发布', '即將推出', 'próximamente', 'bientôt disponible', 'demnächst', 'em breve', 'sắp ra mắt', 'in arrivo']],
    ['11개 언어 · 무료 체험 · 구독 있음', ['11 languages · Free trial · subscription available', '11言語対応 · 無料体験 · サブスクあり', '11 种语言 · 免费试用 · 提供订阅', '11 種語言 · 免費試用 · 提供訂閱', '11 idiomas · Prueba gratuita · con suscripción', '11 langues · Essai gratuit · abonnement disponible', '11 Sprachen · Kostenlos testen · Abo verfügbar', '11 idiomas · Teste grátis · com assinatura', '11 ngôn ngữ · Dùng thử miễn phí · có gói đăng ký', '11 lingue · Prova gratuita · abbonamento disponibile']],
    ['웹 · 파일 전송', ['Web · File transfer', 'Web · ファイル転送', '网页 · 文件传输', '網頁 · 檔案傳輸', 'Web · Transferencia de archivos', 'Web · Transfert de fichiers', 'Web · Dateiübertragung', 'Web · Transferência de arquivos', 'Web · Truyền tệp', 'Web · Trasferimento file']],
    ['초간단 파일공유', ['Quick File Share', 'かんたんファイル共有', '极简文件分享', '極簡檔案分享', 'Compartir archivos rápido', 'Partage de fichiers express', 'Dateien blitzschnell teilen', 'Compartilhar arquivos rápido', 'Chia sẻ tệp nhanh', 'Quick File Share']],
    ['초간단 파일공유 열기', ['Open Quick File Share', 'かんたんファイル共有を開く', '打开极简文件分享', '開啟極簡檔案分享', 'Abrir Compartir archivos rápido', 'Ouvrir Partage de fichiers express', 'Dateien blitzschnell teilen öffnen', 'Abrir Compartilhar arquivos rápido', 'Mở Chia sẻ tệp nhanh', 'Apri Quick File Share']],
    ['회원가입 없이 여섯 자리 코드로 파일을 주고받습니다. 보내는 쪽 브라우저에서 코드로 잠근 뒤 올리고, 보낸 뒤 1분이 지나면 완전히 지워집니다. 회사 컴퓨터에서 내 휴대폰으로, 옆자리 사람에게 문서 한 장 건네듯 가볍게 씁니다. 한국어, 영어, 일본어, 중국어로 쓸 수 있습니다.', [
      'Send and receive files with a six-digit code, no sign-up needed. The file is locked with the code in the sender’s browser before upload, and it is erased completely one minute after sending. Use it as lightly as handing a sheet of paper to the person next to you — from a work computer to your phone, for example. Available in Korean, English, Japanese and Chinese.',
      '会員登録なしで、6桁のコードでファイルをやり取りできます。送る側のブラウザでコードを使ってロックしてからアップロードし、送信から1分たつと完全に削除されます。会社のパソコンから自分のスマホへ、隣の席の人に書類を1枚渡すような気軽さで使えます。韓国語、英語、日本語、中国語に対応しています。',
      '无需注册，凭六位数代码收发文件。发送方在浏览器中用代码加锁后再上传，发送一分钟后彻底删除。从公司电脑传到自己的手机，就像递给旁边的人一份文件那样轻松。支持韩语、英语、日语和中文。',
      '無需註冊，憑六位數代碼收發檔案。傳送方在瀏覽器中用代碼加鎖後再上傳，傳送一分鐘後徹底刪除。從公司電腦傳到自己的手機，就像遞給旁邊的人一份文件那樣輕鬆。支援韓語、英語、日語與中文。',
      'Envía y recibe archivos con un código de seis dígitos, sin registrarte. El archivo se bloquea con el código en el navegador del remitente antes de subirse y se borra por completo un minuto después de enviarse. Se usa con la misma ligereza que pasarle una hoja a quien tienes al lado, por ejemplo del ordenador del trabajo a tu móvil. Disponible en coreano, inglés, japonés y chino.',
      'Envoyez et recevez des fichiers avec un code à six chiffres, sans inscription. Le fichier est verrouillé avec le code dans le navigateur de l’expéditeur avant l’envoi, puis totalement effacé une minute après. Il s’utilise aussi simplement que de tendre une feuille à son voisin, par exemple de l’ordinateur du bureau à votre téléphone. Disponible en coréen, anglais, japonais et chinois.',
      'Dateien per sechsstelligem Code senden und empfangen, ganz ohne Registrierung. Die Datei wird im Browser des Absenders mit dem Code gesperrt und erst dann hochgeladen; eine Minute nach dem Senden wird sie vollständig gelöscht. So unkompliziert, wie man dem Sitznachbarn ein Blatt reicht – etwa vom Firmenrechner aufs eigene Handy. Verfügbar auf Koreanisch, Englisch, Japanisch und Chinesisch.',
      'Envie e receba arquivos com um código de seis dígitos, sem cadastro. O arquivo é bloqueado com o código no navegador de quem envia antes de subir e é apagado por completo um minuto após o envio. Use com a mesma leveza de entregar uma folha a quem está ao lado, por exemplo do computador do trabalho para o seu celular. Disponível em coreano, inglês, japonês e chinês.',
      'Gửi và nhận tệp bằng mã sáu số, không cần đăng ký. Tệp được khóa bằng mã ngay trên trình duyệt của người gửi trước khi tải lên và bị xóa hoàn toàn sau một phút kể từ lúc gửi. Dùng nhẹ nhàng như đưa một tờ giấy cho người ngồi cạnh, chẳng hạn từ máy tính ở công ty sang điện thoại của bạn. Có tiếng Hàn, Anh, Nhật và Trung.',
      'Invia e ricevi file con un codice a sei cifre, senza registrazione. Il file viene bloccato con il codice nel browser di chi lo invia prima del caricamento e viene cancellato del tutto un minuto dopo l’invio. Usalo con la leggerezza con cui passi un foglio al vicino — per esempio dal computer di lavoro al telefono. Disponibile in coreano, inglese, giapponese e cinese.']],
    ['초간단 파일공유 보내기 화면', ['Quick File Share send screen', 'かんたんファイル共有の送信画面', '极简文件分享的发送画面', '極簡檔案分享的傳送畫面', 'Pantalla de envío de Compartir archivos rápido', 'Écran d’envoi de Partage de fichiers express', 'Sendeansicht von Dateien blitzschnell teilen', 'Tela de envio do Compartilhar arquivos rápido', 'Màn hình gửi của Chia sẻ tệp nhanh', 'Schermata di invio di Quick File Share']],
    ['보내기', ['Send', '送る', '发送', '傳送', 'Enviar', 'Envoyer', 'Senden', 'Enviar', 'Gửi', 'Invia']],
    ['열기', ['Open', '開く', '打开', '開啟', 'Abrir', 'Ouvrir', 'Öffnen', 'Abrir', 'Mở', 'Apri']],
    ['회원가입 없음 · 1분 뒤 삭제', ['No sign-up · Deleted after 1 minute', '会員登録不要 · 1分後に削除', '无需注册 · 1 分钟后删除', '無需註冊 · 1 分鐘後刪除', 'Sin registro · Se borra al minuto', 'Sans inscription · Effacé après 1 minute', 'Ohne Registrierung · Nach 1 Minute gelöscht', 'Sem cadastro · Apagado após 1 minuto', 'Không cần đăng ký · Xóa sau 1 phút', 'Nessuna registrazione · Eliminato dopo 1 minuto']],
    ['다음 앱을 만들고 있습니다. 나오면 이 자리에 먼저 올립니다.', [
      'The next app is in the works. When it is ready, it will appear here first.', '次のアプリを制作中です。完成したら、まずここに掲載します。', '下一款应用正在制作中，完成后会第一时间在这里发布。', '下一款應用程式正在製作中，完成後會第一時間在這裡發布。', 'Estamos creando la próxima app. Cuando esté lista, aparecerá aquí primero.', 'La prochaine app est en préparation. Elle apparaîtra ici en premier dès qu’elle sera prête.',
      'Die nächste App ist in Arbeit. Sobald sie fertig ist, erscheint sie zuerst hier.', 'O próximo app está em desenvolvimento. Quando ficar pronto, aparecerá aqui primeiro.', 'Chúng tôi đang làm ứng dụng tiếp theo. Khi hoàn thành, nó sẽ xuất hiện ở đây đầu tiên.', 'La prossima app è in lavorazione. Quando sarà pronta, comparirà qui per prima.']],
    ['· 문의', ['· Contact', '· お問い合わせ', '· 联系', '· 聯絡', '· Contacto', '· Contact', '· Kontakt', '· Contato', '· Liên hệ', '· Contatti']],
    ['ezScan — 책·영수증을 한 번에 반듯하게 펴는 원샷 문서 스캐너', [
      'ezScan — One-shot document scanner for books and receipts', 'ezScan — 本もレシートも一発できれいに伸ばすワンショット書類スキャナー', 'ezScan — 一拍即平的书籍与收据文档扫描仪', 'ezScan — 一拍即平的書籍與收據文件掃描器', 'ezScan — Escáner de documentos de un solo disparo para libros y recibos', 'ezScan — Le scanner de documents en un clic pour livres et tickets',
      'ezScan — Der Ein-Klick-Dokumentenscanner für Bücher und Kassenbons', 'ezScan — Scanner de documentos em um toque para livros e recibos', 'ezScan — Máy quét tài liệu một lần chạm cho sách và hóa đơn', 'ezScan — Scanner di documenti in un colpo solo per libri e scontrini']],
    ['ezScan: 대고 찍으면 끝. 쪽을 찾아 배경을 지우고, 말린 책과 구부러진 영수증을 펴고, 사진 속 글을 원래 모양 그대로 번역합니다. 모든 처리는 기기 안에서 합니다.', [
      'ezScan: point, shoot, done. Finds the page, removes the background, flattens curled book pages and bent receipts, and translates photos in place. Everything stays on your device.',
      'ezScan: かざして撮るだけ。ページを見つけて背景を消し、丸まった本や曲がったレシートを平らにし、写真の中の文字を元のレイアウトのまま翻訳します。すべての処理は端末内で行います。',
      'ezScan：对准一拍即可。自动找出纸页并去除背景，抚平卷曲的书页和折皱的收据，并按原有版式翻译照片中的文字。所有处理都在设备内完成。',
      'ezScan：對準一拍即可。自動找出紙頁並去除背景，撫平捲曲的書頁與皺折的收據，並按原有版面翻譯照片中的文字。所有處理都在裝置內完成。',
      'ezScan: apunta, dispara y listo. Encuentra la página, elimina el fondo, alisa las páginas curvadas de los libros y los recibos arrugados, y traduce el texto de las fotos conservando su diseño. Todo se queda en tu dispositivo.',
      'ezScan : visez, photographiez, c’est fait. Il repère la page, supprime l’arrière-plan, aplatit les pages de livre gondolées et les tickets froissés, et traduit le texte des photos en conservant leur mise en page. Tout reste sur votre appareil.',
      'ezScan: draufhalten, auslösen, fertig. Erkennt die Seite, entfernt den Hintergrund, glättet gewölbte Buchseiten und geknitterte Kassenbons und übersetzt Text in Fotos direkt an Ort und Stelle. Alles bleibt auf Ihrem Gerät.',
      'ezScan: aponte, fotografe e pronto. Encontra a página, remove o fundo, endireita páginas curvas de livros e recibos amassados e traduz o texto das fotos mantendo o layout original. Tudo fica no seu dispositivo.',
      'ezScan: hướng vào, chụp là xong. Tự tìm trang giấy, xóa nền, làm phẳng trang sách cong và hóa đơn nhàu, đồng thời dịch chữ trong ảnh giữ nguyên bố cục. Mọi thứ ở lại trên thiết bị của bạn.',
      'ezScan: inquadra, scatta, fatto. Trova la pagina, rimuove lo sfondo, appiattisce le pagine curve dei libri e gli scontrini piegati e traduce le foto sul posto. Tutto resta sul tuo dispositivo.']],
    ['ezScan — 책·영수증을 한 번에 반듯하게', [
      'ezScan — Books and receipts, flat in one shot', 'ezScan — 本もレシートも一発できれいに', 'ezScan — 书籍与收据，一拍就平整', 'ezScan — 書籍與收據，一拍就平整', 'ezScan — Libros y recibos planos de un solo disparo', 'ezScan — Livres et tickets bien à plat en un clic',
      'ezScan — Bücher und Kassenbons mit einem Klick glatt', 'ezScan — Livros e recibos planos em um toque', 'ezScan — Sách và hóa đơn phẳng phiu chỉ một lần chụp', 'ezScan — Libri e scontrini, piatti in un colpo solo']],
    ['대고 찍으면 끝. 말린 책과 구부러진 영수증을 펴고, 사진 속 글을 원래 모양 그대로 번역합니다. 모든 처리는 기기 안에서.', [
      'Point, shoot, done. Flattens curled books and bent receipts, and translates text in photos in its original layout. Everything is processed on your device.',
      'かざして撮るだけ。丸まった本や曲がったレシートを平らにし、写真の中の文字を元のレイアウトのまま翻訳します。すべての処理は端末内で。',
      '对准一拍即可。抚平卷曲的书页和折皱的收据，并按原有版式翻译照片中的文字。所有处理都在设备内完成。',
      '對準一拍即可。撫平捲曲的書頁與皺折的收據，並按原有版面翻譯照片中的文字。所有處理都在裝置內完成。',
      'Apunta, dispara y listo. Alisa libros curvados y recibos arrugados, y traduce el texto de las fotos conservando su diseño. Todo se procesa en tu dispositivo.',
      'Visez, photographiez, c’est fait. Aplatit les livres gondolés et les tickets froissés, et traduit le texte des photos en gardant leur mise en page. Tout est traité sur l’appareil.',
      'Draufhalten, auslösen, fertig. Glättet gewölbte Bücher und geknitterte Kassenbons und übersetzt Text in Fotos im Originallayout. Alles wird auf dem Gerät verarbeitet.',
      'Aponte, fotografe e pronto. Endireita livros curvos e recibos amassados e traduz o texto das fotos no layout original. Tudo é processado no dispositivo.',
      'Hướng vào, chụp là xong. Làm phẳng sách cong và hóa đơn nhàu, dịch chữ trong ảnh giữ nguyên bố cục. Mọi xử lý đều trên thiết bị.',
      'Inquadra, scatta, fatto. Appiattisce libri curvi e scontrini piegati e traduce il testo nelle foto mantenendo il layout originale. Tutto viene elaborato sul tuo dispositivo.']],
    ['ezScan 아이콘', ['ezScan icon', 'ezScanのアイコン', 'ezScan 图标', 'ezScan 圖示', 'Icono de ezScan', 'Icône d’ezScan', 'ezScan-Symbol', 'Ícone do ezScan', 'Biểu tượng ezScan', 'Icona di ezScan']],
    ['책·영수증을 한 번에 반듯하게', [
      'Books and receipts, flat in one shot', '本もレシートも一発できれいに', '书籍与收据，一拍就平整', '書籍與收據，一拍就平整', 'Libros y recibos planos de un solo disparo', 'Livres et tickets bien à plat en un clic',
      'Bücher und Kassenbons mit einem Klick glatt', 'Livros e recibos planos em um toque', 'Sách và hóa đơn phẳng phiu chỉ một lần chụp', 'Libri e scontrini, piatti in un colpo solo']],
    ['스캔', ['Scan', 'スキャン', '扫描', '掃描', 'Escanear', 'Numériser', 'Scannen', 'Digitalizar', 'Quét', 'Scansiona']],
    ['카메라로 비추고 한 번 누르면, 쪽을 찾아 펴서 저장합니다. 모서리를 손으로 맞출 필요가 없습니다.', [
      'Point the camera and tap once. ezScan finds the page, flattens it and saves it. No corner dragging.',
      'カメラを向けて1回タップするだけで、ページを見つけて平らにし、保存します。角を手で合わせる必要はありません。',
      '用相机对准轻点一下，自动找出纸页、抚平并保存。无需手动调整边角。',
      '用相機對準輕點一下，自動找出紙頁、撫平並儲存。無需手動調整邊角。',
      'Apunta con la cámara y pulsa una vez: ezScan encuentra la página, la alisa y la guarda. Sin arrastrar las esquinas.',
      'Pointez l’appareil photo et touchez une fois : ezScan repère la page, l’aplatit et l’enregistre. Pas besoin d’ajuster les coins.',
      'Kamera draufhalten und einmal tippen: ezScan erkennt die Seite, glättet sie und speichert sie. Keine Ecken von Hand ziehen.',
      'Aponte a câmera e toque uma vez: o ezScan encontra a página, endireita e salva. Sem arrastar os cantos.',
      'Hướng camera và chạm một lần: ezScan tự tìm trang, làm phẳng và lưu lại. Không cần kéo chỉnh các góc.',
      'Inquadra e tocca una volta. ezScan trova la pagina, la appiattisce e la salva. Niente angoli da trascinare.']],
    ['사진에서', ['From Photos', '写真から', '从照片导入', '從照片匯入', 'Desde Fotos', 'Depuis Photos', 'Aus Fotos', 'De Fotos', 'Từ Ảnh', 'Da Foto']],
    ['찍어 둔 사진도 펴고 깨끗하게', [
      'Flatten and clean photos you already took', '撮影済みの写真も平らにしてきれいに', '已拍的照片也能抚平并变清晰', '已拍的照片也能撫平並變清晰', 'Alisa y limpia las fotos que ya hiciste', 'Aplatissez et nettoyez les photos déjà prises',
      'Bereits aufgenommene Fotos glätten und säubern', 'Endireite e limpe fotos que você já tirou', 'Làm phẳng và làm sạch cả ảnh đã chụp', 'Appiattisci e pulisci le foto che hai già scattato']],
    ['수집 텍스트', ['Saved Quotes', '保存した文章', '收集的文字', '收集的文字', 'Citas guardadas', 'Citations enregistrées', 'Gesammelte Zitate', 'Citações salvas', 'Câu đã lưu', 'Citazioni salvate']],
    ['책에서 마음에 든 문장을 모아 둡니다', [
      'Keep the sentences you love from books', '本で気に入った文章を集めておけます', '收集书中喜欢的句子', '收集書中喜歡的句子', 'Guarda las frases que te gustan de los libros', 'Gardez les phrases que vous aimez dans vos livres',
      'Sammeln Sie Lieblingssätze aus Büchern', 'Guarde as frases de que você gosta nos livros', 'Lưu lại những câu bạn thích trong sách', 'Conserva le frasi che ami dei libri']],
    ['사진 번역', ['Photo Translate', '写真翻訳', '照片翻译', '照片翻譯', 'Traducir fotos', 'Traduction de photos', 'Fototübersetzung', 'Tradução de fotos', 'Dịch ảnh', 'Traduzione foto']],
    ['새 기능', ['New', '新機能', '新功能', '新功能', 'Novedad', 'Nouveau', 'Neu', 'Novo', 'Mới', 'Novità']],
    ['원래 모양 그대로 번역합니다. 표·차트·그림 속 설명까지 그 자리에서만 바뀝니다. 기기 번역은 무료, 내 AI 키로 더 자연스럽게.', [
      'Translates in place, keeping the original layout — even labels in tables, charts and pictures. On-device translation is free; use your own AI key for more natural results.',
      '元のレイアウトのまま翻訳します。表・グラフ・図の中の説明文も、その場所だけが置き換わります。端末内の翻訳は無料、自分のAIキーを使えばより自然な翻訳になります。',
      '保持原有版式进行翻译，表格、图表和图片中的说明文字也只在原位替换。设备端翻译免费，使用自己的 AI 密钥可获得更自然的译文。',
      '保持原有版面進行翻譯，表格、圖表和圖片中的說明文字也只在原位替換。裝置端翻譯免費，使用自己的 AI 金鑰可獲得更自然的譯文。',
      'Traduce en el mismo lugar y conserva el diseño original, incluso las etiquetas de tablas, gráficos e imágenes. La traducción en el dispositivo es gratuita; usa tu propia clave de IA para un resultado más natural.',
      'Traduit sur place en conservant la mise en page d’origine, y compris les légendes des tableaux, graphiques et images. La traduction sur l’appareil est gratuite ; utilisez votre propre clé d’IA pour un rendu plus naturel.',
      'Übersetzt an Ort und Stelle im Originallayout – auch Beschriftungen in Tabellen, Diagrammen und Bildern. Die Übersetzung auf dem Gerät ist kostenlos; mit eigenem KI-Schlüssel klingt sie natürlicher.',
      'Traduz no próprio lugar, mantendo o layout original, até legendas em tabelas, gráficos e imagens. A tradução no dispositivo é gratuita; use sua própria chave de IA para um resultado mais natural.',
      'Dịch ngay tại chỗ, giữ nguyên bố cục gốc, kể cả chú thích trong bảng, biểu đồ và hình ảnh. Dịch trên thiết bị là miễn phí; dùng khóa AI của riêng bạn để bản dịch tự nhiên hơn.',
      'Traduce sul posto mantenendo il layout originale — anche le etichette in tabelle, grafici e immagini. La traduzione sul dispositivo è gratuita; usa la tua chiave IA per risultati più naturali.']],
    ['찍으면 끝나는 이유', ['Why it just works', '撮るだけで終わる理由', '为什么一拍就搞定', '為什麼一拍就搞定', 'Por qué funciona sin esfuerzo', 'Pourquoi tout est si simple', 'Warum es einfach funktioniert', 'Por que funciona sem esforço', 'Vì sao chỉ cần chụp là xong', 'Perché funziona e basta']],
    ['책은 한 쪽씩, 반듯하게', ['Books, page by page', '本は1ページずつ、まっすぐに', '书籍逐页拆分，平整规整', '書籍逐頁拆分，平整規整', 'Libros, página a página', 'Les livres, page par page', 'Bücher, Seite für Seite', 'Livros, página por página', 'Sách từng trang, phẳng phiu', 'Libri, pagina per pagina']],
    ['펼친 두 쪽을 한 쪽씩 나누고 책등 근처의 휨을 폅니다.', [
      'Two-page spreads are split into separate pages and the curve near the spine is flattened.', '見開き2ページを1ページずつに分け、綴じ目付近の歪みを伸ばします。', '把展开的两页拆成单页，并抚平书脊附近的弯曲。', '把展開的兩頁拆成單頁，並撫平書脊附近的彎曲。', 'Las dobles páginas se dividen en páginas sueltas y se alisa la curva junto al lomo.', 'Les doubles pages sont séparées en pages simples et la courbure près de la reliure est aplatie.',
      'Doppelseiten werden in Einzelseiten geteilt und die Wölbung am Falz wird geglättet.', 'Páginas duplas são separadas em páginas individuais e a curva perto da lombada é endireitada.', 'Hai trang mở được tách thành từng trang và phần cong gần gáy sách được làm phẳng.', 'Le doppie pagine vengono divise in pagine singole e la curvatura vicino alla rilegatura viene appiattita.']],
    ['구부러진 영수증도 평평하게', ['Bent receipts, made flat', '曲がったレシートも平らに', '折皱的收据也能抚平', '皺折的收據也能撫平', 'Recibos arrugados, planos', 'Les tickets froissés, bien à plat', 'Geknitterte Kassenbons, glatt', 'Recibos amassados, planos', 'Hóa đơn nhàu cũng phẳng', 'Scontrini piegati, resi piatti']],
    ['접히고 말린 종이를 펴고 배경을 지웁니다.', [
      'Curled and folded paper is straightened and the background removed.', '折れたり丸まったりした紙を伸ばし、背景を消します。', '抚平折叠卷曲的纸张并去除背景。', '撫平摺疊捲曲的紙張並去除背景。', 'El papel doblado o enrollado se alisa y se elimina el fondo.', 'Le papier plié ou enroulé est redressé et l’arrière-plan supprimé.',
      'Gefaltetes und gerolltes Papier wird geglättet und der Hintergrund entfernt.', 'O papel dobrado ou enrolado é endireitado e o fundo é removido.', 'Giấy bị gấp hoặc cuộn được làm phẳng và nền được xóa.', 'La carta arricciata e piegata viene raddrizzata e lo sfondo rimosso.']],
    ['보기 좋은 세 가지 보정', ['Three clean looks', '見やすい3つの補正', '三种清晰美观的校正', '三種清晰美觀的校正', 'Tres acabados limpios', 'Trois rendus nets', 'Drei saubere Looks', 'Três acabamentos limpos', 'Ba kiểu hiệu chỉnh dễ nhìn', 'Tre look puliti']],
    ['컬러, 회색, 흑백 중에서 고릅니다. 평판 스캐너로 스캔한 것처럼.', [
      'Color, grayscale or black and white — like a flatbed scanner.', 'カラー、グレー、白黒から選べます。フラットベッドスキャナーで読み取ったように。', '可选彩色、灰度或黑白，效果如同平板扫描仪。', '可選彩色、灰階或黑白，效果如同平板掃描器。', 'Color, gris o blanco y negro, como con un escáner de sobremesa.', 'Couleur, gris ou noir et blanc, comme avec un scanner à plat.',
      'Farbe, Graustufen oder Schwarzweiß – wie von einem Flachbettscanner.', 'Cor, cinza ou preto e branco, como num scanner de mesa.', 'Chọn màu, xám hoặc đen trắng, như quét bằng máy quét phẳng.', 'Colore, scala di grigi o bianco e nero — come uno scanner a piano.']],
    ['저장과 공유는 바로', ['Save and share instantly', 'すぐに保存・共有', '保存与分享一步到位', '儲存與分享一步到位', 'Guarda y comparte al instante', 'Enregistrez et partagez aussitôt', 'Sofort speichern und teilen', 'Salve e compartilhe na hora', 'Lưu và chia sẻ ngay', 'Salva e condividi all’istante']],
    ['사진 앱에 저장하거나 여러 쪽을 PDF 하나로 공유합니다.', [
      'Save to Photos or share many pages as one PDF.', '写真アプリに保存したり、複数ページを1つのPDFにして共有したりできます。', '可保存到相册，或把多页合成一个 PDF 分享。', '可儲存到相簿，或把多頁合成一個 PDF 分享。', 'Guarda en Fotos o comparte varias páginas como un solo PDF.', 'Enregistrez dans Photos ou partagez plusieurs pages en un seul PDF.',
      'In Fotos sichern oder viele Seiten als ein PDF teilen.', 'Salve em Fotos ou compartilhe várias páginas como um só PDF.', 'Lưu vào Ảnh hoặc chia sẻ nhiều trang thành một tệp PDF.', 'Salva in Foto o condividi più pagine in un unico PDF.']],
    ['무료로 충분하고, Pro는 더 편하게', ['Free is plenty. Pro is easier.', '無料で十分、Proならもっと快適', '免费已足够，Pro 更省心', '免費已足夠，Pro 更省心', 'Lo gratis basta. Pro es más cómodo.', 'Le gratuit suffit, Pro est plus confortable.', 'Kostenlos reicht aus, Pro ist bequemer.', 'O grátis já basta. O Pro é mais prático.', 'Miễn phí là đủ, Pro tiện hơn', 'Il gratuito basta e avanza. Pro è più comodo.']],
    ['스캔 기능 전부', ['Every scanning feature', 'スキャン機能はすべて', '全部扫描功能', '全部掃描功能', 'Todas las funciones de escaneo', 'Toutes les fonctions de numérisation', 'Alle Scan-Funktionen', 'Todos os recursos de digitalização', 'Toàn bộ tính năng quét', 'Tutte le funzioni di scansione']],
    ['사진에서 펴기, 수집 텍스트', ['From Photos and Saved Quotes', '写真から伸ばす、保存した文章', '从照片抚平、收集文字', '從照片撫平、收集文字', 'Desde Fotos y citas guardadas', 'Depuis Photos et citations enregistrées', 'Aus Fotos und gesammelte Zitate', 'De Fotos e citações salvas', 'Từ Ảnh và câu đã lưu', 'Da Foto e Citazioni salvate']],
    ['기기 번역으로 사진 번역', ['Photo translate with on-device translation', '端末内翻訳で写真を翻訳', '用设备端翻译来翻译照片', '用裝置端翻譯來翻譯照片', 'Traducción de fotos con traducción en el dispositivo', 'Traduction de photos avec la traduction sur l’appareil', 'Fototübersetzung mit Übersetzung auf dem Gerät', 'Tradução de fotos com tradução no dispositivo', 'Dịch ảnh bằng bản dịch trên thiết bị', 'Traduzione foto con traduzione sul dispositivo']],
    ['광고 없음', ['No ads', '広告なし', '无广告', '無廣告', 'Sin anuncios', 'Sans publicité', 'Keine Werbung', 'Sem anúncios', 'Không quảng cáo', 'Niente pubblicità']],
    ['내 AI 키(ChatGPT·Claude·Gemini 등)로 더 자연스러운 번역', [
      'More natural translation with your own AI key (ChatGPT, Claude, Gemini and more)', '自分のAIキー（ChatGPT・Claude・Geminiなど）でより自然な翻訳', '使用自己的 AI 密钥（ChatGPT、Claude、Gemini 等）获得更自然的翻译', '使用自己的 AI 金鑰（ChatGPT、Claude、Gemini 等）獲得更自然的翻譯', 'Traducción más natural con tu propia clave de IA (ChatGPT, Claude, Gemini y más)', 'Traduction plus naturelle avec votre propre clé d’IA (ChatGPT, Claude, Gemini, etc.)',
      'Natürlichere Übersetzung mit eigenem KI-Schlüssel (ChatGPT, Claude, Gemini u. a.)', 'Tradução mais natural com sua própria chave de IA (ChatGPT, Claude, Gemini e mais)', 'Dịch tự nhiên hơn bằng khóa AI của riêng bạn (ChatGPT, Claude, Gemini, v.v.)', 'Traduzione più naturale con la tua chiave IA (ChatGPT, Claude, Gemini e altri)']],
    ['무료 체험 후 구독', ['Free trial, then subscription', '無料体験のあとサブスクリプション', '免费试用后订阅', '免費試用後訂閱', 'Prueba gratuita y después suscripción', 'Essai gratuit, puis abonnement', 'Kostenlos testen, danach Abo', 'Teste grátis e depois assinatura', 'Dùng thử miễn phí, sau đó đăng ký', 'Prova gratuita, poi abbonamento']],
    ['내 문서는 내 휴대폰에', ['Your documents stay on your phone', '書類は自分のスマホの中に', '文档只留在你的手机里', '文件只留在你的手機裡', 'Tus documentos se quedan en tu móvil', 'Vos documents restent sur votre téléphone', 'Ihre Dokumente bleiben auf Ihrem Handy', 'Seus documentos ficam no seu celular', 'Tài liệu của bạn ở lại trên điện thoại', 'I tuoi documenti restano sul telefono']],
    ['모든 처리는 기기 안에서 합니다.', ['Everything is processed on your device.', 'すべての処理は端末内で行います。', '所有处理都在设备内完成。', '所有處理都在裝置內完成。', 'Todo se procesa en tu dispositivo.', 'Tout est traité sur votre appareil.', 'Alles wird auf Ihrem Gerät verarbeitet.', 'Tudo é processado no seu dispositivo.', 'Mọi xử lý đều diễn ra trên thiết bị của bạn.', 'Tutto viene elaborato sul tuo dispositivo.']],
    ['찍은 문서를 서버에 올리지 않습니다. 내 AI 키로 번역할 때만 번역할 텍스트가 고르신 AI 회사로 갑니다.', [
      'Nothing you scan is uploaded. Only when you translate with your own AI key is the text to translate sent to the AI company you chose.',
      'スキャンした書類をサーバーにアップロードすることはありません。自分のAIキーで翻訳するときだけ、翻訳するテキストが選んだAI会社に送られます。',
      '扫描的文档不会上传到服务器。只有使用自己的 AI 密钥翻译时，待翻译的文字才会发送给你选择的 AI 公司。',
      '掃描的文件不會上傳到伺服器。只有使用自己的 AI 金鑰翻譯時，待翻譯的文字才會傳送給你選擇的 AI 公司。',
      'Nada de lo que escaneas se sube a un servidor. Solo cuando traduces con tu propia clave de IA, el texto a traducir se envía a la empresa de IA que elegiste.',
      'Rien de ce que vous numérisez n’est envoyé à un serveur. Ce n’est que lorsque vous traduisez avec votre propre clé d’IA que le texte à traduire est transmis à l’entreprise d’IA choisie.',
      'Gescannte Dokumente werden nicht hochgeladen. Nur wenn Sie mit Ihrem eigenen KI-Schlüssel übersetzen, wird der zu übersetzende Text an das von Ihnen gewählte KI-Unternehmen gesendet.',
      'Nada do que você digitaliza é enviado a servidores. Somente ao traduzir com sua própria chave de IA, o texto a traduzir é enviado à empresa de IA que você escolheu.',
      'Những gì bạn quét không được tải lên máy chủ. Chỉ khi dịch bằng khóa AI của riêng bạn, đoạn văn bản cần dịch mới được gửi đến công ty AI mà bạn đã chọn.',
      'Nulla di ciò che scansioni viene caricato. Solo quando traduci con la tua chiave IA, il testo da tradurre viene inviato all’azienda di IA che hai scelto.']],
    ['개인정보처리방침', ['Privacy Policy', 'プライバシーポリシー', '隐私政策', '隱私權政策', 'Política de privacidad', 'Politique de confidentialité', 'Datenschutzerklärung', 'Política de privacidade', 'Chính sách quyền riêng tư', 'Informativa sulla privacy']],
    ['지원', ['Support', 'サポート', '支持', '支援', 'Soporte', 'Assistance', 'Support', 'Suporte', 'Hỗ trợ', 'Assistenza']],
    ['EZLONG 앱 모음', ['EZLONG apps', 'EZLONGアプリ集', 'EZLONG 应用合集', 'EZLONG 應用程式合集', 'Apps de EZLONG', 'Apps EZLONG', 'EZLONG-Apps', 'Apps da EZLONG', 'Ứng dụng EZLONG', 'App EZLONG']],
  ];

  var D = {};
  for (var i = 0; i < K.length; i++) D[K[i][0]] = K[i][1];
  var HAN = /[가-힣]/;
  var STORE = 'ez_lang';
  var cur = 'ko';
  var baseCanon = null;

  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
  function has(code) { for (var i = 0; i < LANGS.length; i++) if (LANGS[i][0] === code) return true; return false; }
  function fromTag(t) {
    t = String(t || '').toLowerCase().replace('_', '-');
    if (!t) return null;
    if (t.indexOf('zh') === 0) return /tw|hk|mo|hant/.test(t) ? 'zh-TW' : 'zh-CN';
    var b = t.slice(0, 2);
    return has(b) ? b : null;
  }
  function tr(key, lang) {
    var r = D[key];
    if (!r) return null;
    var i = IDX[lang];
    return (i != null && r[i]) || r[0] || null;
  }
  function detect() {
    var q = null;
    try { q = new URLSearchParams(location.search).get('lang'); } catch (e) {}
    var l = fromTag(q);
    if (l) return l;
    try { l = fromTag(localStorage.getItem(STORE)); } catch (e2) { l = null; }
    if (l) return l;
    /* 검색 로봇은 한국어 원문 그대로 본다. */
    if (/bot|crawl|spider|slurp|yeti|daum|lighthouse/i.test(navigator.userAgent || '')) return 'ko';
    var n = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    if (!n) return 'ko';
    return fromTag(n) || 'en';
  }

  function inSkip(el) {
    for (; el && el.nodeType === 1; el = el.parentNode) {
      var t = el.tagName;
      if (t === 'SCRIPT' || t === 'STYLE' || t === 'NOSCRIPT') return true;
      if (el.classList && (el.classList.contains('ezapps') || el.classList.contains('ez-lang'))) return true;
    }
    return false;
  }
  function setText(n, lang) {
    if (n.__ko === undefined) n.__ko = HAN.test(n.data) ? n.data : null;
    if (n.__ko === null) return;
    var out = n.__ko;
    if (lang !== 'ko') {
      var t = tr(norm(n.__ko), lang);
      if (t) out = n.__ko.match(/^\s*/)[0] + t + n.__ko.match(/\s*$/)[0];
    }
    if (n.data !== out) n.data = out;
  }
  function setAttr(el, name, lang) {
    var st = el.__ko || (el.__ko = {});
    if (st[name] === undefined) {
      var v = el.getAttribute(name);
      st[name] = (v && HAN.test(v)) ? v : null;
    }
    if (st[name] === null) return;
    var out = st[name];
    if (lang !== 'ko') { var t = tr(norm(st[name]), lang); if (t) out = t; }
    if (el.getAttribute(name) !== out) el.setAttribute(name, out);
  }

  function apply(lang) {
    cur = lang;
    var de = document.documentElement;
    if (de.getAttribute('lang') !== lang) de.setAttribute('lang', lang);
    var w = document.createTreeWalker(de, NodeFilter.SHOW_TEXT, null, false), n, list = [];
    while ((n = w.nextNode())) { if (!inSkip(n.parentNode)) list.push(n); }
    for (var i = 0; i < list.length; i++) setText(list[i], lang);
    var as = ['title', 'aria-label', 'alt', 'placeholder'];
    for (var a = 0; a < as.length; a++) {
      var els = document.querySelectorAll('[' + as[a] + ']');
      for (var j = 0; j < els.length; j++) if (!inSkip(els[j])) setAttr(els[j], as[a], lang);
    }
    var ms = document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]');
    for (var m = 0; m < ms.length; m++) setAttr(ms[m], 'content', lang);
    /* 정본 주소·og:url 도 언어별로 맞춘다. */
    var c = document.querySelector('link[rel="canonical"]');
    if (c) {
      if (baseCanon === null) baseCanon = c.getAttribute('href');
      c.setAttribute('href', lang === 'ko' ? baseCanon : baseCanon + '?lang=' + lang);
    }
    var ou = document.querySelector('meta[property="og:url"]');
    if (ou && c) ou.setAttribute('content', c.getAttribute('href'));
    /* 다른 쪽 소개 글의 #ko 해시는 한국어일 때만 둔다. */
    var hs = document.querySelectorAll('a[href*="#ko"]');
    for (var h = 0; h < hs.length; h++) {
      if (hs[h].__href === undefined) hs[h].__href = hs[h].getAttribute('href');
      hs[h].setAttribute('href', lang === 'ko' ? hs[h].__href : hs[h].__href.replace('#ko', ''));
    }
    var sel = document.querySelector('.ez-lang select');
    if (sel && sel.value !== lang) sel.value = lang;
    try { document.dispatchEvent(new CustomEvent('ezlangchange', { detail: lang })); } catch (e) {}
  }

  function choose(lang) {
    try { localStorage.setItem(STORE, lang); } catch (e) {}
    try {
      var u = new URL(location.href);
      u.searchParams.set('lang', lang);
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch (e2) {}
    apply(lang);
  }

  function build() {
    var css = document.createElement('style');
    css.textContent = '.ez-lang{display:flex;justify-content:flex-end;margin:4px 0 8px}' +
      '.ez-lang select{font:inherit;font-size:14px;line-height:1.2;padding:6px 28px 6px 12px;border-radius:99px;' +
      'border:1px solid var(--line,#d9d9d9);background-color:var(--panel,var(--card,#fff));color:var(--sub,var(--mut,#555));' +
      'cursor:pointer;max-width:100%}' +
      '.ez-lang select:focus-visible{outline:2px solid var(--accent,var(--acc,#2b6cb0));outline-offset:2px}';
    document.head.appendChild(css);
    var box = document.createElement('div');
    box.className = 'ez-lang';
    var sel = document.createElement('select');
    sel.setAttribute('aria-label', 'Language');
    for (var i = 0; i < LANGS.length; i++) {
      var o = document.createElement('option');
      o.value = LANGS[i][0]; o.textContent = LANGS[i][1];
      sel.appendChild(o);
    }
    sel.addEventListener('change', function () { choose(sel.value); });
    box.appendChild(sel);
    var slot = document.getElementById('ez-lang-slot');
    if (slot) slot.appendChild(box);
    else {
      var host = document.querySelector('header .wrap') || document.querySelector('main') || document.body;
      host.insertBefore(box, host.firstChild);
    }
  }

  function start() {
    build();
    apply(detect());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  window.EzLang = { set: choose, get: function () { return cur; }, langs: LANGS };
})();
