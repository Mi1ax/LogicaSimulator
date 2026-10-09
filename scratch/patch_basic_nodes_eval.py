import re

with open('src/core/engine/nodes/basicNodes.ts', 'r') as f:
    content = f.read()

sub_in_old = """  evaluate: (_, props) => {
    return [props?.value === 1 ? 1 : 0];
  }"""
sub_in_new = """  evaluate: (_, props) => {
    return [props?._isFlattened ? undefined : (props?.value === 1 ? 1 : 0)];
  }"""

sub_io_old = """  evaluate: () => [] // Passive receiver"""
sub_io_new = """  evaluate: (_, props) => [props?._isFlattened ? undefined : (props?.value === 1 ? 1 : 0)]"""

content = content.replace(sub_in_old, sub_in_new)
content = content.replace(sub_io_old, sub_io_new)

with open('src/core/engine/nodes/basicNodes.ts', 'w') as f:
    f.write(content)

