-- CreateTable
CREATE TABLE "LetterSender" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "ico" TEXT,
    "dic" TEXT,
    "addressLines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "email" TEXT,
    "phone" TEXT,
    "web" TEXT,
    "bankAccount" TEXT,
    "logoPath" TEXT,
    "signaturePath" TEXT,
    "redactPrompt" TEXT NOT NULL DEFAULT 'Učeš text dopisu do formálního, zdvořilého a srozumitelného tónu. Zachovej oslovení i závěr napsané uživatelem. Neměň fakta. Vrať jen výsledný text bez vysvětlivek a bez markdown formátování.',
    "pdfTheme" TEXT NOT NULL DEFAULT 'classic',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LetterSender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LetterRecipient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LetterRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Letter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT,
    "recipientNameSnapshot" TEXT,
    "recipientAddressLinesSnapshot" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "showRecipientAddress" BOOLEAN NOT NULL DEFAULT true,
    "letterDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "place" TEXT,
    "bodyRaw" TEXT NOT NULL,
    "bodyFinal" TEXT NOT NULL,
    "promptOverride" TEXT,
    "parentLetterId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "pdfPath" TEXT,
    "pdfGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Letter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LetterSender_userId_idx" ON "LetterSender"("userId");

-- CreateIndex
CREATE INDEX "LetterRecipient_userId_idx" ON "LetterRecipient"("userId");

-- CreateIndex
CREATE INDEX "Letter_userId_createdAt_idx" ON "Letter"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Letter_senderId_idx" ON "Letter"("senderId");

-- AddForeignKey
ALTER TABLE "LetterSender" ADD CONSTRAINT "LetterSender_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LetterRecipient" ADD CONSTRAINT "LetterRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "LetterSender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "LetterRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_parentLetterId_fkey" FOREIGN KEY ("parentLetterId") REFERENCES "Letter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
