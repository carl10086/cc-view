export interface SystemSubtype {
  subtype: string
  description: string
  example?: string
}

interface SystemSubtypeTableProps {
  subtypes: SystemSubtype[]
}

export function SystemSubtypeTable({ subtypes }: SystemSubtypeTableProps) {
  if (subtypes.length === 0) return null

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Subtype
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              说明
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {subtypes.map((item) => (
            <tr
              key={item.subtype}
              className="hover:bg-muted/50 transition-colors"
            >
              <td className="px-4 py-3">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                  {item.subtype}
                </code>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {item.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
