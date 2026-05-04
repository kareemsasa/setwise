export default async function WorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main>
      <h1>Workout {id}</h1>
      <p>Workout session detail and logging. Not yet implemented.</p>
    </main>
  );
}
