import IndexPage from '@/app/_legacy/IndexPage';

// "/" — landing. Legacy script.js handles routing into login/signup/dashboard
// client-side based on path/query/hash.
export default function Page() {
  return <IndexPage />;
}
