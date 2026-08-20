import Link from "next/link";

export default function DemoHome() {
  return (
    <section>
      <h1 className="text-2xl font-bold mb-2">CRUD demo</h1>
      <p className="text-gray-600 mb-6 text-sm">
        Click a page and use the forms. This only calls the REST APIs.
      </p>
      <ol className="list-decimal ml-5 space-y-2 text-blue-600">
        <li><Link href="/demo/locations">Locations</Link></li>
        <li><Link href="/demo/events">Events</Link></li>
        <li><Link href="/demo/tasks">Tasks</Link></li>
        <li><Link href="/demo/resource-types">Resource types</Link></li>
        <li><Link href="/demo/resources">Resources</Link></li>
        <li><Link href="/demo/allocations">Allocations</Link></li>
      </ol>
    </section>
  );
}
