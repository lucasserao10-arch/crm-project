export function InteractionForm({ contactId, ownerId }: { contactId: string; ownerId: string }) {
  return <div data-contact-id={contactId} data-owner-id={ownerId} />
}
