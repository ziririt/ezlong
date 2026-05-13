import type { NextPage } from 'next';

const AUTHOR_URL =
  'https://contents.premium.naver.com/unis/something/authors/192d7ba6b7bltz';

interface Article {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
}

interface NaverData {
  articles: Article[];
  updatedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const naverData = require('@/data/naver-content.json') as NaverData;

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

const Home: NextPage = () => {
  const articles = naverData.articles.slice(0, 5);
  const updatedAt = naverData.updatedAt;

  return (
    <main className="min-h-screen flex items-start justify-center px-6 py-20">
      <div className="w-full max-w-xl">
        {/* 헤더 */}
        <header className="mb-14">
          <h1 className="text-2xl font-bold tracking-tight">ezlong</h1>
          <p className="mt-1 text-sm text-gray-400">네이버 프리미엄 콘텐츠</p>
        </header>

        {/* 글 목록 */}
        <section>
          {articles.length === 0 ? (
            <p className="text-gray-400 text-sm">
              아직 글 정보가 없습니다. 잠시 후 다시 확인해 주세요.
            </p>
          ) : (
            <ul className="space-y-6">
              {articles.map((article) => (
                <li key={article.id}>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                  >
                    <span className="font-medium leading-snug group-hover:text-blue-600 transition-colors">
                      {article.title}
                    </span>
                    {article.publishedAt && (
                      <time className="block mt-0.5 text-xs text-gray-400">
                        {formatDate(article.publishedAt)}
                      </time>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )}

          {/* 더보기 */}
          <div className="mt-10 pt-6 border-t border-gray-100">
            <a
              href={AUTHOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-400 hover:text-gray-800 transition-colors"
            >
              더보기 →
            </a>
          </div>
        </section>

        {/* 마지막 업데이트 시간 (작게) */}
        {updatedAt && (
          <footer className="mt-16 text-xs text-gray-300">
            마지막 업데이트: {formatDate(updatedAt)}
          </footer>
        )}
      </div>
    </main>
  );
};

export default Home;
