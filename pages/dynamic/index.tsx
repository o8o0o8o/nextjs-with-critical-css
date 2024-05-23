import type { InferGetServerSidePropsType, GetServerSideProps } from "next";

type Repo = {
  name: string;
  stargazers_count: number;
};

export const getServerSideProps = (async () => {
  const res = await fetch("https://api.github.com/repos/vercel/next.js");
  const repo: Repo = await res.json();

  return { props: { repo } };
}) satisfies GetServerSideProps<{ repo: Repo }>;

export default function Page({
  repo,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <main className="container">
      <p className="data">{repo.stargazers_count}</p>
    </main>
  );
}
