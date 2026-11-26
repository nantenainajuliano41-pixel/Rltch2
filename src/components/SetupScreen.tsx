export function SetupScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
        <div className="mb-4 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
          Configuration requise
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Supabase n'est pas configuré</h1>
        <p className="mt-3 text-slate-600">
          Les variables d'environnement suivantes sont manquantes. Ajoutez-les dans un fichier{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">.env</code> en local, ou dans
          les variables d'environnement de Netlify, puis exécutez{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">supabase/schema.sql</code>{" "}
          dans votre projet Supabase.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm text-slate-100">
{`VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon-publique`}
        </pre>
        <p className="mt-4 text-sm text-slate-500">
          Ces valeurs se trouvent dans Supabase : <strong>Project Settings → API</strong>. Utilisez
          uniquement la clé <em>anon</em> (publique), jamais la clé <em>service_role</em>.
        </p>
      </div>
    </div>
  );
}
