export interface AttachmentCategory {
  name: string
  subtypes: {
    type: string
    description: string
  }[]
}

interface AttachmentTypeTableProps {
  categories: AttachmentCategory[]
}

export function AttachmentTypeTable({ categories }: AttachmentTypeTableProps) {
  if (categories.length === 0) return null

  return (
    <div className="space-y-8">
      {categories.map((category) => (
        <div key={category.name}>
          <h3 className="text-lg font-medium text-foreground mb-3">
            {category.name}
          </h3>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    子类型
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    说明
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {category.subtypes.map((item) => (
                  <tr
                    key={item.type}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                        {item.type}
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
        </div>
      ))}
    </div>
  )
}
