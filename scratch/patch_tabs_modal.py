import re

with open('src/ui/components/CircuitTabs.tsx', 'r') as f:
    content = f.read()

# Add ConfirmModal import
content = content.replace("import { Plus, X } from 'lucide-react';", "import { Plus, X } from 'lucide-react';\nimport { ConfirmModal } from './ConfirmModal';")

# Add state
state_logic = """  const [newName, setNewName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);"""
content = content.replace("  const [newName, setNewName] = useState('');", state_logic)

# Replace confirm
content = content.replace(
    "onClick={(e) => { e.stopPropagation(); if (confirm('Delete subcircuit?')) deleteSubcircuit(sc.id); }}",
    "onClick={(e) => { e.stopPropagation(); setDeletingId(sc.id); }}"
)

# Append modal to end of component
modal_code = """
      <ConfirmModal
        isOpen={deletingId !== null}
        title="Delete Subcircuit"
        message="Are you sure you want to delete this subcircuit? This action cannot be undone."
        onConfirm={() => {
          if (deletingId) {
            deleteSubcircuit(deletingId);
            setDeletingId(null);
          }
        }}
        onCancel={() => setDeletingId(null)}
      />
    </div>
"""
content = content.replace("    </div>\n  );\n};", modal_code + "  );\n};")

with open('src/ui/components/CircuitTabs.tsx', 'w') as f:
    f.write(content)
