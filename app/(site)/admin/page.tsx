import IndexPage from '@/app/_legacy/IndexPage';

// /admin — same legacy app shell. The pre-paint script in IndexPage detects the
// "/admin" path and sets body[data-role="admin"] before paint (admin theme).
export default function Page() {
  return <IndexPage />;
}
